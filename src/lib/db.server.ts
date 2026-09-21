import { createClient } from "@supabase/supabase-js";

/** Cliente de banco somente-servidor (service role). Nunca importar no cliente. */
export function getDb() {
  return createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function log(
  event: string,
  status: string,
  data?: unknown,
  executionId?: string | null,
  stepId?: string | null,
) {
  const db = getDb();
  await db.from("automation_logs").insert({
    execution_id: executionId ?? null,
    step_id: stepId ?? null,
    event,
    status,
    data: (data ?? null) as never,
  });
  console.log(`[${event}] ${status}`, data ? JSON.stringify(data).slice(0, 500) : "");
}

/** Normaliza telefone para o formato aceito pelo provedor: apenas digitos. */
export function normalizePhone(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}
