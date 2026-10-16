import { serve } from "@hono/node-server";
import { ClaudeModel } from "./model.js";
import { FileReviewStore } from "./review.js";
import { createApp } from "./server.js";

const apiKeys = (process.env.DOCUREAD_API_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean);
if (!apiKeys.length) console.warn("DOCUREAD_API_KEYS is empty: the API is open. Only do this locally.");

const app = createApp({
  model: new ClaudeModel(),
  store: new FileReviewStore(process.env.DOCUREAD_REVIEW_FILE ?? "data/review.json"),
  apiKeys,
  threshold: process.env.DOCUREAD_THRESHOLD ? Number(process.env.DOCUREAD_THRESHOLD) : undefined,
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => console.log(`DocuRead listening on http://localhost:${port}`));
