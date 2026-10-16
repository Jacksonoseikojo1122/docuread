import type { ExtractResult } from "../src/pipeline.js";
import type { Case } from "./cases.js";

export type FieldOutcome = { field: string; expected: unknown; got: unknown; correct: boolean; accepted: boolean };
export type CaseOutcome = {
  id: string;
  decision: ExtractResult["decision"];
  fields: FieldOutcome[];
  mustReview: boolean;
  reviewedAsRequired: boolean;
  expectedExpired: boolean;
  flaggedExpired: boolean;
};

export type Summary = {
  cases: number;
  fields: number;
  accuracy: number; // correct fields / all fields
  silentErrors: number; // wrong AND accepted: the number that matters most
  silentErrorRate: number;
  caughtErrors: number; // wrong but sent to review: the system doing its job
  reviewRate: number; // share of documents sent to review
  mustReviewRecall: number; // documents that had to be reviewed and were
  expiryFlagAccuracy: number;
  rejected: number;
};

export function scoreCase(c: Case, r: ExtractResult, today: string): CaseOutcome {
  const expectedExpired = typeof c.expected.expiry_date === "string" && c.expected.expiry_date < today;
  if (r.decision === "rejected") {
    return {
      id: c.id,
      decision: r.decision,
      fields: Object.entries(c.expected).map(([field, expected]) => ({ field, expected, got: null, correct: false, accepted: false })),
      mustReview: !!c.mustReview,
      reviewedAsRequired: true, // a rejected document reaches a person too
      expectedExpired,
      flaggedExpired: false,
    };
  }
  const fields = Object.entries(c.expected).map(([field, expected]) => {
    const f = r.fields[field];
    const got = f?.normalized ?? null;
    const norm = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : v);
    return { field, expected, got, correct: norm(got) === norm(expected), accepted: f?.status === "accepted" };
  });
  return {
    id: c.id,
    decision: r.decision,
    fields,
    mustReview: !!c.mustReview,
    reviewedAsRequired: !c.mustReview || r.decision === "needs_review",
    expectedExpired,
    flaggedExpired: r.flags.includes("expired"),
  };
}

export function summarize(outcomes: CaseOutcome[]): Summary {
  const all = outcomes.flatMap((o) => o.fields);
  const wrong = all.filter((f) => !f.correct);
  const silent = wrong.filter((f) => f.accepted).length;
  const must = outcomes.filter((o) => o.mustReview);
  const certs = outcomes.filter((o) => o.fields.some((f) => f.field === "expiry_date"));
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 100);
  return {
    cases: outcomes.length,
    fields: all.length,
    accuracy: pct(all.length - wrong.length, all.length),
    silentErrors: silent,
    silentErrorRate: pct(silent, all.length),
    caughtErrors: wrong.length - silent,
    reviewRate: pct(outcomes.filter((o) => o.decision !== "accepted").length, outcomes.length),
    mustReviewRecall: pct(must.filter((o) => o.reviewedAsRequired).length, must.length),
    expiryFlagAccuracy: pct(certs.filter((o) => o.expectedExpired === o.flaggedExpired).length, certs.length),
    rejected: outcomes.filter((o) => o.decision === "rejected").length,
  };
}

/** A change is a regression if it lets more mistakes through or reads noticeably worse. */
export function regressions(now: Summary, base: Summary): string[] {
  const out: string[] = [];
  if (now.silentErrors > base.silentErrors) out.push(`silent errors rose ${base.silentErrors} -> ${now.silentErrors}`);
  if (now.accuracy < base.accuracy - 2) out.push(`accuracy fell ${base.accuracy}% -> ${now.accuracy}%`);
  if (now.mustReviewRecall < base.mustReviewRecall) out.push(`must-review recall fell ${base.mustReviewRecall}% -> ${now.mustReviewRecall}%`);
  return out;
}
