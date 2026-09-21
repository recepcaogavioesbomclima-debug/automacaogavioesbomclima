import { createFileRoute } from "@tanstack/react-router";

import { getDb, log, normalizePhone } from "@/lib/db.server";
import { handleInboundReply } from "@/lib/engine.server";

/**
 * Webhook REAL do provedor. A URL inclui um token secreto:
 *   /api/public/hooks/whapi?token=<WHAPI_WEBHOOK_TOKEN>
 */
export const Route = createFileRoute("/api/public/hooks/whapi")({
  server: {
    handlers: {
      GET: async () => new Response("ok"),
      POST: async ({ request }) => {
        const expected = process.env["WHAPI_WEBHOOK_TOKEN"];
        const token = new URL(request.url).searchParams.get("token");
        if (!expected || token !== expected) {
          return new Response("unauthorized", { status: 401 });
        }

        const raw = await request.text();
        let payload: any = null;
        try {
          payload = raw ? JSON.parse(raw) : null;
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const db = getDb();
        const messages: any[] = Array.isArray(payload?.messages) ? payload.messages : [];
        const eventId =
          messages[0]?.id ??
          payload?.event?.id ??
          `${payload?.channel_id ?? "whapi"}:${raw.length}:${JSON.stringify(payload?.statuses ?? "")}`.slice(0, 200);

        const { error: insertError } = await db.from("webhook_events").insert({
          provider_event_id: String(eventId),
          event_type: payload?.event?.type ?? (messages.length ? "messages" : "unknown"),
          payload,
        });

        if (insertError) {
          // evento duplicado: nao processar de novo
          await log("WEBHOOK_DUPLICATE", "OK", { eventId });
          return new Response("duplicate", { status: 200 });
        }

        await log("WEBHOOK_RECEIVED", "OK", { eventId, count: messages.length });

        for (const message of messages) {
          if (message?.from_me) continue;
          const phone = normalizePhone(String(message?.from ?? message?.chat_id ?? ""));
          const content =
            message?.text?.body ?? message?.caption ?? message?.type ?? "";
          const providerMessageId = message?.id ? String(message.id) : null;

          if (providerMessageId) {
            const { data: known } = await db
              .from("messages")
              .select("id")
              .eq("provider_message_id", providerMessageId)
              .maybeSingle();
            if (known) continue;
          }

          await db.from("messages").insert({
            provider_message_id: providerMessageId,
            phone,
            direction: "IN",
            content: String(content),
            type: String(message?.type ?? "text"),
            status: "RECEIVED",
            chat_id: message?.chat_id ? String(message.chat_id) : null,
          });
          await log("MESSAGE_RECEIVED", "OK", { phone, providerMessageId });

          if (phone) await handleInboundReply(phone, String(content));
        }

        await db
          .from("webhook_events")
          .update({ processed_at: new Date().toISOString() })
          .eq("provider_event_id", String(eventId));

        return Response.json({ ok: true });
      },
    },
  },
});
