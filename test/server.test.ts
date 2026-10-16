import { describe, expect, it } from "vitest";
import { createApp } from "../src/server.js";
import { MemoryReviewStore } from "../src/review.js";
import { FakeModel } from "./fake-model.js";

const good = { value: "Osu Fresh Mart", confidence: 0.95 };
const model = new FakeModel(() => ({
  notes: "",
  fields: {
    merchant_name: good,
    date: { value: "2026-09-14", confidence: 0.95 },
    currency: { value: "GHS", confidence: 0.95 },
    subtotal: { value: "212.40", confidence: 0.95 },
    tax: { value: "46.73", confidence: 0.95 },
    total: { value: "999.00", confidence: 0.99 }, // confidently wrong
  },
}));

const body = (over: object = {}) =>
  JSON.stringify({ type: "receipt", media_type: "image/png", data: Buffer.from("png").toString("base64"), ...over });

function setup(extra: Partial<Parameters<typeof createApp>[0]> = {}) {
  const store = new MemoryReviewStore();
  const app = createApp({ model, store, apiKeys: ["k1"], ...extra });
  const post = (path: string, b: string, key = "k1") =>
    app.request(path, { method: "POST", body: b, headers: { "content-type": "application/json", authorization: `Bearer ${key}` } });
  return { app, store, post };
}

describe("HTTP API", () => {
  it("rejects requests without a valid key", async () => {
    const { post } = setup();
    expect((await post("/v1/extract", body(), "nope")).status).toBe(401);
  });

  it("validates type and media type", async () => {
    const { post } = setup();
    expect((await post("/v1/extract", body({ type: "passport" }))).status).toBe(400);
    expect((await post("/v1/extract", body({ media_type: "text/plain" }))).status).toBe(400);
  });

  it("sends a confidently wrong total to the review queue", async () => {
    const { post, app } = setup();
    const res = await post("/v1/extract", body());
    expect(res.status).toBe(200);
    const json = (await res.json()) as { id: string; decision: string };
    expect(json.decision).toBe("needs_review");

    const list = (await (await app.request("/v1/review?status=pending", { headers: { authorization: "Bearer k1" } })).json()) as {
      items: { id: string }[];
    };
    expect(list.items.map((i) => i.id)).toContain(json.id);

    const resolved = await post(`/v1/review/${json.id}/resolve`, JSON.stringify({ corrections: { total: "259.13", nonsense: "x" } }));
    const item = (await resolved.json()) as { status: string; corrections: Record<string, string> };
    expect(item.status).toBe("resolved");
    expect(item.corrections).toEqual({ total: "259.13" });
  });

  it("rate-limits each key", async () => {
    const { post } = setup({ perMinute: 2 });
    await post("/v1/extract", body());
    await post("/v1/extract", body());
    const third = await post("/v1/extract", body());
    expect(third.status).toBe(429);
    expect(third.headers.get("retry-after")).toBeTruthy();
  });

  it("returns 422 when the model refuses", async () => {
    const refusing = new FakeModel(() => ({ ok: false, reason: "refused", detail: "declined", model: "fake" }));
    const { post } = setup({ model: refusing });
    expect((await post("/v1/extract", body())).status).toBe(422);
  });
});
