import { getDb, log, normalizePhone } from "./db.server";
import { WhatsAppProvider, ProviderNotConfiguredError } from "./whatsapp-provider.server";

const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_SECONDS = [60, 300, 900];

export type StepType =
  | "SEND_MESSAGE"
  | "WAIT"
  | "CHECK_CONDITION"
  | "END_AUTOMATION"
  | "PAUSE_AUTOMATION"
  | "RESUME_AUTOMATION";

interface StepRow {
  id: string;
  order_index: number;
  type: StepType;
  config: Record<string, any>;
}

interface ExecutionRow {
  id: string;
  automation_id: string;
  phone: string;
  status: string;
  current_step: number;
  attempts: number;
  replied: boolean;
}

/** Janela de horario permitido. Retorna null se pode enviar agora. */
async function nextAllowedTime(now = new Date()): Promise<Date | null> {
  const db = getDb();
  const { data } = await db.from("send_window").select("*").eq("id", true).maybeSingle();
  if (!data) return null;
  const offset = data.tz_offset_minutes as number;
  const days = data.days as number[];
  const startHour = data.start_hour as number;
  const endHour = data.end_hour as number;

  for (let i = 0; i < 8 * 24; i += 1) {
    const candidate = new Date(now.getTime() + i * 60 * 60 * 1000);
    const local = new Date(candidate.getTime() + offset * 60 * 1000);
    const day = local.getUTCDay();
    const hour = local.getUTCHours();
    if (!days.includes(day)) continue;
    if (i === 0 && hour >= startHour && hour < endHour) return null;
    if (hour >= startHour && hour < endHour) {
      // inicio da proxima hora permitida
      const aligned = new Date(candidate.getTime());
      aligned.setUTCMinutes(0, 0, 0);
      return aligned;
    }
  }
  return new Date(now.getTime() + 60 * 60 * 1000);
}

/** Inicia a automacao ativa para o gatilho LEAD_CREATED. */
export async function triggerLeadCreated(leadId: string, phone: string) {
  const db = getDb();
  const { data: automations } = await db
    .from("automations")
    .select("id")
    .eq("status", "ACTIVE")
    .eq("trigger", "LEAD_CREATED");

  const created: string[] = [];
  for (const automation of automations ?? []) {
    // idempotencia: uma execucao ativa por automacao + lead
    const { data: existing } = await db
      .from("automation_executions")
      .select("id")
      .eq("automation_id", automation.id)
      .eq("lead_id", leadId)
      .maybeSingle();
    if (existing) continue;

    const { data: execution, error } = await db
      .from("automation_executions")
      .insert({
        automation_id: automation.id,
        lead_id: leadId,
        phone: normalizePhone(phone),
        status: "PENDING",
        current_step: 0,
        next_run_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    created.push(execution.id);
    await log("AUTOMATION_STARTED", "OK", { automationId: automation.id, leadId }, execution.id);
  }
  return created;
}

/** Marca resposta do cliente e encerra follow-ups pendentes. */
export async function handleInboundReply(phone: string, content: string) {
  const db = getDb();
  const normalized = normalizePhone(phone);
  const { data: executions } = await db
    .from("automation_executions")
    .select("id, status")
    .eq("phone", normalized)
    .in("status", ["PENDING", "WAITING", "RUNNING", "PAUSED"]);

  for (const execution of executions ?? []) {
    await db
      .from("automation_executions")
      .update({ replied: true, updated_at: new Date().toISOString() })
      .eq("id", execution.id);
    await log("REPLY_DETECTED", "OK", { phone: normalized, content }, execution.id);

    // A regra da automacao de exemplo: resposta encerra a automacao.
    await db
      .from("automation_executions")
      .update({
        status: "COMPLETED",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        next_run_at: new Date().toISOString(),
      })
      .eq("id", execution.id)
      .in("status", ["PENDING", "WAITING", "PAUSED"]);
    await log("AUTOMATION_COMPLETED", "OK", { reason: "cliente respondeu" }, execution.id);
  }
}

async function loadSteps(automationId: string): Promise<StepRow[]> {
  const db = getDb();
  const { data } = await db
    .from("automation_steps")
    .select("id, order_index, type, config")
    .eq("automation_id", automationId)
    .order("order_index", { ascending: true });
  return (data ?? []) as StepRow[];
}

async function completeExecution(executionId: string, reason: string) {
  const db = getDb();
  await db
    .from("automation_executions")
    .update({
      status: "COMPLETED",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", executionId);
  await log("AUTOMATION_COMPLETED", "OK", { reason }, executionId);
}

/** Envio real e idempotente. A chave garante 1 envio por (execucao, etapa). */
export async function sendMessageIdempotent(params: {
  phone: string;
  content: string;
  idempotencyKey: string;
  executionId?: string | null;
}): Promise<{ skipped: boolean; providerMessageId?: string }> {
  const db = getDb();
  const phone = normalizePhone(params.phone);

  const { data: existing } = await db
    .from("messages")
    .select("id, status, provider_message_id")
    .eq("idempotency_key", params.idempotencyKey)
    .maybeSingle();

  if (existing && existing.status === "SENT") {
    await log("SEND_SKIPPED_DUPLICATE", "OK", { key: params.idempotencyKey }, params.executionId);
    return { skipped: true, providerMessageId: existing.provider_message_id ?? undefined };
  }

  if (!existing) {
    const { error } = await db.from("messages").insert({
      phone,
      direction: "OUT",
      content: params.content,
      type: "text",
      status: "PENDING",
      idempotency_key: params.idempotencyKey,
      execution_id: params.executionId ?? null,
    });
    // corrida: outro worker ja inseriu a mesma chave
    if (error && !`${error.message}`.includes("duplicate")) throw error;
    if (error) return { skipped: true };
  }

  try {
    const result = await WhatsAppProvider.sendMessage(phone, params.content);
    await db
      .from("messages")
      .update({
        status: "SENT",
        provider_message_id: result.providerMessageId,
        chat_id: result.chatId,
      })
      .eq("idempotency_key", params.idempotencyKey);
    await log(
      "MESSAGE_SENT",
      "OK",
      { phone, providerMessageId: result.providerMessageId },
      params.executionId,
    );
    return { skipped: false, providerMessageId: result.providerMessageId };
  } catch (error: any) {
    await db
      .from("messages")
      .update({ status: "FAILED", error: String(error?.message ?? error) })
      .eq("idempotency_key", params.idempotencyKey);
    await log("MESSAGE_SEND_FAILED", "ERROR", { phone, error: String(error?.message ?? error) }, params.executionId);
    throw error;
  }
}

/** Processa UMA etapa da execucao. */
async function processExecution(execution: ExecutionRow) {
  const db = getDb();
  const steps = await loadSteps(execution.automation_id);
  const step = steps[execution.current_step];

  if (!step) {
    await completeExecution(execution.id, "fim do fluxo");
    return;
  }

  const advance = async (nextRunAt: Date, status: string) => {
    await db
      .from("automation_executions")
      .update({
        current_step: execution.current_step + 1,
        next_run_at: nextRunAt.toISOString(),
        status,
        attempts: 0,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", execution.id);
  };

  switch (step.type) {
    case "SEND_MESSAGE": {
      const allowedAt = await nextAllowedTime();
      if (allowedAt) {
        await db
          .from("automation_executions")
          .update({
            status: "WAITING",
            next_run_at: allowedAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", execution.id);
        await log("RESCHEDULED_OUT_OF_WINDOW", "OK", { nextRunAt: allowedAt }, execution.id, step.id);
        return;
      }
      const content = String(step.config?.["message"] ?? "");
      if (!content.trim()) throw new Error("Etapa SEND_MESSAGE sem mensagem configurada");
      await sendMessageIdempotent({
        phone: execution.phone,
        content,
        idempotencyKey: `exec:${execution.id}:step:${step.id}`,
        executionId: execution.id,
      });
      await log("STEP_EXECUTED", "OK", { type: step.type }, execution.id, step.id);
      await advance(new Date(), "PENDING");
      return;
    }
    case "WAIT": {
      const seconds = Number(step.config?.["seconds"] ?? 0);
      const nextRunAt = new Date(Date.now() + seconds * 1000);
      await advance(nextRunAt, "WAITING");
      await log("WAIT_SCHEDULED", "OK", { seconds, nextRunAt }, execution.id, step.id);
      return;
    }
    case "CHECK_CONDITION": {
      const { data: fresh } = await db
        .from("automation_executions")
        .select("replied")
        .eq("id", execution.id)
        .single();
      const replied = Boolean(fresh?.replied);
      const expected = step.config?.["replied"] !== false;
      const matched = replied === expected;
      const action = matched
        ? String(step.config?.["ifTrue"] ?? "END")
        : String(step.config?.["ifFalse"] ?? "CONTINUE");
      await log("CONDITION_CHECKED", "OK", { replied, matched, action }, execution.id, step.id);
      if (action === "END") {
        await completeExecution(execution.id, "condicao atendida");
        return;
      }
      await advance(new Date(), "PENDING");
      return;
    }
    case "END_AUTOMATION": {
      await completeExecution(execution.id, "etapa END_AUTOMATION");
      return;
    }
    case "PAUSE_AUTOMATION": {
      await db
        .from("automation_executions")
        .update({
          status: "PAUSED",
          current_step: execution.current_step + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", execution.id);
      await log("AUTOMATION_PAUSED", "OK", {}, execution.id, step.id);
      return;
    }
    case "RESUME_AUTOMATION": {
      await advance(new Date(), "PENDING");
      return;
    }
    default:
      throw new Error(`Tipo de etapa desconhecido: ${step.type}`);
  }
}

/** Worker: processa todas as execucoes vencidas. Chamado pelo agendador. */
export async function runDueExecutions(limit = 20) {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const { data: due } = await db
    .from("automation_executions")
    .select("id, automation_id, phone, status, current_step, attempts, replied")
    .in("status", ["PENDING", "WAITING"])
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(limit);

  let processed = 0;
  for (const row of (due ?? []) as ExecutionRow[]) {
    // lock otimista: so processa quem conseguir mudar o status
    const { data: locked } = await db
      .from("automation_executions")
      .update({ status: "RUNNING", updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .in("status", ["PENDING", "WAITING"])
      .select("id")
      .maybeSingle();
    if (!locked) continue;

    try {
      await processExecution(row);
      processed += 1;
    } catch (error: any) {
      const attempts = row.attempts + 1;
      const message = String(error?.message ?? error);
      if (error instanceof ProviderNotConfiguredError || attempts >= MAX_ATTEMPTS) {
        await db
          .from("automation_executions")
          .update({
            status: "FAILED",
            attempts,
            last_error: message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        await log("EXECUTION_FAILED", "ERROR", { attempts, error: message }, row.id);
      } else {
        const delay = RETRY_BACKOFF_SECONDS[attempts - 1] ?? 900;
        await db
          .from("automation_executions")
          .update({
            status: "WAITING",
            attempts,
            last_error: message,
            next_run_at: new Date(Date.now() + delay * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        await log("RETRY_SCHEDULED", "WARN", { attempts, delay, error: message }, row.id);
      }
    }
  }
  return { due: due?.length ?? 0, processed };
}
