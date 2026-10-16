import { describe, expect, it } from "vitest";
import { regressions, scoreCase, summarize } from "../eval/score.js";
import type { Case } from "../eval/cases.js";
import type { ExtractResult } from "../src/pipeline.js";

const c: Case = {
  id: "t",
  type: "receipt",
  note: "",
  printed: {},
  expected: { merchant_name: "Shop", date: "2026-01-02", currency: "GHS", subtotal: null, tax: null, total: 500 },
};

const field = (normalized: string | number | null, status: "accepted" | "needs_review" = "accepted") => ({
  value: String(normalized), normalized, confidence: 0.9, status, issues: [],
});

const result = (total: number, status: "accepted" | "needs_review"): ExtractResult => ({
  id: "1", type: "receipt", decision: status, flags: [], notes: "", model: "fake",
  fields: {
    merchant_name: field("shop"), date: field("2026-01-02"), currency: field("GHS"),
    subtotal: field(null), tax: field(null), total: field(total, status),
  },
});

describe("eval scoring", () => {
  it("counts a wrong field that was accepted as a silent error", () => {
    const s = summarize([scoreCase(c, result(501, "accepted"), "2026-10-16")]);
    expect(s.silentErrors).toBe(1);
    expect(s.caughtErrors).toBe(0);
  });

  it("counts a wrong field sent to review as caught, not silent", () => {
    const s = summarize([scoreCase(c, result(501, "needs_review"), "2026-10-16")]);
    expect(s.silentErrors).toBe(0);
    expect(s.caughtErrors).toBe(1);
  });

  it("compares text case-insensitively", () => {
    expect(summarize([scoreCase(c, result(500, "accepted"), "2026-10-16")]).accuracy).toBe(100);
  });

  it("reports a regression when silent errors rise", () => {
    const good = summarize([scoreCase(c, result(500, "accepted"), "2026-10-16")]);
    const bad = summarize([scoreCase(c, result(501, "accepted"), "2026-10-16")]);
    expect(regressions(bad, good)).toHaveLength(2);
    expect(regressions(good, bad)).toHaveLength(0);
  });
});
