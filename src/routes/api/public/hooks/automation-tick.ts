import { createFileRoute } from "@tanstack/react-router";

import { runDueExecutions } from "@/lib/engine.server";

/**
 * Worker do motor: processa execucoes cujo nextRunAt ja venceu.
 * Chamado pelo agendador do banco (a cada minuto) e tambem pela interface.
 */
export const Route = createFileRoute("/api/public/hooks/automation-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["WHAPI_WEBHOOK_TOKEN"];
        const token = new URL(request.url).searchParams.get("token");
        if (!expected || token !== expected) {
          return new Response("unauthorized", { status: 401 });
        }
        const result = await runDueExecutions();
        return Response.json(result);
      },
    },
  },
});
