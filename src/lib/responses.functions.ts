import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getResponsesBase = createServerFn({ method: "GET" }).handler(async () => {
  const { getDb } = await import("./db.server");
  const db = getDb() as any;
  const [{ data: info }, { data: intents }] = await Promise.all([
    db.from("business_info").select("content, fallback_reply").eq("id", true).maybeSingle(),
    db.from("intent_responses").select("*").order("priority", { ascending: false }).order("intent"),
  ]);
  return {
    content: (info?.content ?? "") as string,
    fallbackReply: (info?.fallback_reply ?? "") as string,
    intents: (intents ?? []) as {
      id: string;
      intent: string;
      examples: string;
      response: string;
      alternatives: string[];
      priority: number;
      active: boolean;
    }[],
  };
});

export const saveBusinessInfo = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ content: z.string().max(20000), fallbackReply: z.string().min(1).max(1000) }).parse(d))
  .handler(async ({ data }) => {
    const { getDb } = await import("./db.server");
    const { error } = await (getDb() as any)
      .from("business_info")
      .upsert({ id: true, content: data.content, fallback_reply: data.fallbackReply, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveIntent = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        intent: z.string().min(1).max(100),
        examples: z.string().max(2000),
        response: z.string().max(4000),
        alternatives: z.array(z.string().max(4000)).max(10),
        priority: z.number().int().min(0).max(100),
        active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { getDb } = await import("./db.server");
    const db = getDb() as any;
    const { id, ...row } = data;
    const { error } = id
      ? await db.from("intent_responses").update(row).eq("id", id)
      : await db.from("intent_responses").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteIntent = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { getDb } = await import("./db.server");
    await (getDb() as any).from("intent_responses").delete().eq("id", data.id);
    return { ok: true };
  });
