import { Hono } from "hono";
import type { ExtractionModel } from "./model.js";
import { processDocument } from "./pipeline.js";
import type { ReviewStore } from "./review.js";
import { DOC_TYPES, MEDIA_TYPES, type DocType, type MediaType } from "./schemas.js";

export type AppOptions = {
  model: ExtractionModel;
  store: ReviewStore;
  apiKeys: string[]; // empty = auth off (local dev only)
  threshold?: number;
  perMinute?: number; // extract calls per key per minute
  maxBytes?: number;
};

type Env = { Variables: { key: string } };

export function createApp(opts: AppOptions) {
  const app = new Hono<Env>();
  const perMinute = opts.perMinute ?? 20;
  const maxBytes = opts.maxBytes ?? 10 * 1024 * 1024;
  // Every extract is a paid model call, so each key gets a small budget per minute.
  const windows = new Map<string, { start: number; count: number }>();

  app.get("/health", (c) => c.json({ ok: true, model: opts.model.name }));

  app.use("/v1/*", async (c, next) => {
    if (opts.apiKeys.length) {
      const key = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      if (!opts.apiKeys.includes(key)) return c.json({ error: "Missing or invalid API key" }, 401);
      c.set("key", key);
    } else {
      c.set("key", "dev");
    }
    await next();
  });

  app.post("/v1/extract", async (c) => {
    const key = c.get("key");
    const now = Date.now();
    const w = windows.get(key);
    if (!w || now - w.start > 60_000) windows.set(key, { start: now, count: 1 });
    else if (++w.count > perMinute) {
      c.header("Retry-After", String(Math.ceil((60_000 - (now - w.start)) / 1000)));
      return c.json({ error: "Rate limit reached, try again shortly" }, 429);
    }

    let type: string | undefined;
    let mediaType: string | undefined;
    let data: string | undefined;

    const ct = c.req.header("content-type") ?? "";
    if (ct.includes("multipart/form-data")) {
      const form = await c.req.formData();
      const file = form.get("file");
      type = String(form.get("type") ?? "");
      if (!(file instanceof File)) return c.json({ error: "Send the document in a 'file' field" }, 400);
      if (file.size > maxBytes) return c.json({ error: `File is larger than ${maxBytes} bytes` }, 413);
      mediaType = file.type;
      data = Buffer.from(await file.arrayBuffer()).toString("base64");
    } else {
      const body = (await c.req.json().catch(() => null)) as { type?: string; media_type?: string; data?: string } | null;
      if (!body) return c.json({ error: "Send JSON {type, media_type, data} or multipart form data" }, 400);
      ({ type, media_type: mediaType, data } = body);
      if (data && Buffer.byteLength(data, "base64") > maxBytes) return c.json({ error: "Document too large" }, 413);
    }

    if (!type || !DOC_TYPES.includes(type as DocType)) {
      return c.json({ error: `type must be one of: ${DOC_TYPES.join(", ")}` }, 400);
    }
    if (!mediaType || !MEDIA_TYPES.includes(mediaType as MediaType)) {
      return c.json({ error: `media_type must be one of: ${MEDIA_TYPES.join(", ")}` }, 400);
    }
    if (!data) return c.json({ error: "data is empty" }, 400);

    const result = await processDocument(
      { mediaType: mediaType as MediaType, data: data.replace(/\s/g, "") },
      type as DocType,
      { model: opts.model, store: opts.store },
      { threshold: opts.threshold },
    );
    return c.json(result, result.decision === "rejected" ? 422 : 200);
  });

  app.get("/v1/review", async (c) => {
    const status = c.req.query("status");
    const items = await opts.store.list(status === "pending" || status === "resolved" ? status : undefined);
    return c.json({ items });
  });

  app.get("/v1/review/:id", async (c) => {
    const item = await opts.store.get(c.req.param("id"));
    return item ? c.json(item) : c.json({ error: "Not found" }, 404);
  });

  app.post("/v1/review/:id/resolve", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { corrections?: Record<string, string | null> } | null;
    const item = await opts.store.resolve(c.req.param("id"), body?.corrections ?? {});
    return item ? c.json(item) : c.json({ error: "Not found" }, 404);
  });

  return app;
}
