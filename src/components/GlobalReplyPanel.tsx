import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { getGlobalReply, saveGlobalReply, setContactAi } from "@/lib/responses.functions";

const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function GlobalReplyPanel() {
  const qc = useQueryClient();
  const loadFn = useServerFn(getGlobalReply);
  const saveFn = useServerFn(saveGlobalReply);
  const contactFn = useServerFn(setContactAi);
  const q = useQuery({ queryKey: ["global-reply"], queryFn: () => loadFn() });
  const [s, setS] = useState({ enabled: true, reply_new_leads: true, reply_existing: true, context_messages: 20, min_interval_seconds: 5 });
  useEffect(() => {
    if (q.data?.settings) setS(q.data.settings);
  }, [q.data]);
  const save = useMutation({ mutationFn: () => saveFn({ data: s }) });
  const toggle = useMutation({
    mutationFn: (v: { phone: string; paused: boolean }) => contactFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["global-reply"] }),
  });
  const check = (key: "enabled" | "reply_new_leads" | "reply_existing", label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={s[key]} onChange={(e) => setS({ ...s, [key]: e.target.checked })} />
      {label}
    </label>
  );

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-1 text-base font-semibold">🤖 Resposta inteligente global</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Responde quem manda mensagem e não está em nenhuma automação, usando a mesma base desta página. Quem está em automação
        continua sendo atendido pela automação.
      </p>
      <div className="grid gap-2">
        {check("enabled", `Ativada (${s.enabled ? "ATIVADA" : "DESATIVADA"})`)}
        {check("reply_new_leads", "Responder contatos novos")}
        {check("reply_existing", "Responder contatos que já conversaram")}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Mensagens de contexto
            <input type="number" min={1} max={50} className={`${input} mt-1`} value={s.context_messages}
              onChange={(e) => setS({ ...s, context_messages: Number(e.target.value) })} />
          </label>
          <label className="text-sm">
            Espera antes de responder (segundos)
            <input type="number" min={5} max={600} className={`${input} mt-1`} value={s.min_interval_seconds}
              onChange={(e) => setS({ ...s, min_interval_seconds: Number(e.target.value) })} />
          </label>
        </div>
      </div>
      <button onClick={() => save.mutate()} disabled={save.isPending}
        className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {save.isPending ? "Salvando..." : save.isSuccess ? "Salvo ✓" : "Salvar configuração"}
      </button>

      <h3 className="mb-2 mt-5 text-sm font-semibold">Contatos recentes</h3>
      <div className="grid gap-2">
        {(q.data?.recent ?? []).map((c) => (
          <div key={c.phone} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <div>
              <div className="font-medium">{c.phone}</div>
              <div className="text-xs text-muted-foreground">
                IA {c.paused ? "PAUSADA" : "ATIVA"} · última mensagem {new Date(c.lastAt).toLocaleString("pt-BR")}
              </div>
            </div>
            <button onClick={() => toggle.mutate({ phone: c.phone, paused: !c.paused })}
              className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent">
              {c.paused ? "Retomar IA" : "Pausar IA"}
            </button>
          </div>
        ))}
        {!q.data?.recent.length && <p className="text-sm text-muted-foreground">Nenhuma mensagem recebida ainda.</p>}
      </div>
    </section>
  );
}
