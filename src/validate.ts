import { FIELDS, type DocType, type FieldKind, type RawExtraction } from "./schemas.js";

export type Issue =
  | "missing_required"
  | "low_confidence"
  | "invalid_date"
  | "invalid_money"
  | "invalid_currency"
  | "totals_mismatch"
  | "dates_out_of_order";

export type FieldResult = {
  value: string | null; // as the model read it
  normalized: string | number | null; // ISO date, integer minor units, or trimmed text
  confidence: number; // the model's own, clamped to 0..1
  status: "accepted" | "needs_review";
  issues: Issue[];
};

export type Validated = {
  decision: "accepted" | "needs_review";
  fields: Record<string, FieldResult>;
  flags: string[]; // facts worth surfacing that don't need review, e.g. "expired"
};

export type ValidateOptions = { threshold?: number; today?: string };

// Currencies we expect to see. Anything else goes to review rather than through.
const CURRENCIES = new Set([
  "GHS", "NGN", "KES", "ZAR", "XOF", "XAF", "UGX", "TZS", "RWF", "EGP", "MAD",
  "USD", "EUR", "GBP", "CAD", "AUD", "AED", "INR", "CNY", "JPY", "CHF",
]);

const clamp = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function parseDate(s: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // Rejects 2026-02-30 and friends: the calendar has to agree with the digits.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return m[0];
}

/** "1,250.5" -> 125050. Integer minor units, so totals compare exactly. */
export function parseMoney(s: string): number | null {
  const t = s.trim().replace(/,/g, "");
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const minor = Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0") || 0);
  return m[1] ? -minor : minor;
}

function normalize(kind: FieldKind, value: string): { normalized: string | number | null; issue?: Issue } {
  switch (kind) {
    case "date": {
      const d = parseDate(value);
      return d ? { normalized: d } : { normalized: null, issue: "invalid_date" };
    }
    case "money": {
      const n = parseMoney(value);
      return n === null ? { normalized: null, issue: "invalid_money" } : { normalized: n };
    }
    case "currency": {
      const c = value.trim().toUpperCase();
      return CURRENCIES.has(c) ? { normalized: c } : { normalized: null, issue: "invalid_currency" };
    }
    default:
      return { normalized: value.trim().replace(/\s+/g, " ") };
  }
}

export function validate(type: DocType, raw: RawExtraction, opts: ValidateOptions = {}): Validated {
  const threshold = opts.threshold ?? 0.85;
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const specs = FIELDS[type];
  const fields: Record<string, FieldResult> = {};
  const flags: string[] = [];

  for (const [name, spec] of Object.entries(specs)) {
    const rf = raw.fields[name];
    const value = rf?.value ?? null;
    const confidence = clamp(rf?.confidence ?? 0);
    const issues: Issue[] = [];
    let normalized: string | number | null = null;

    if (value === null || value.trim() === "") {
      if (spec.required) issues.push("missing_required");
    } else {
      const n = normalize(spec.kind, value);
      normalized = n.normalized;
      if (n.issue) issues.push(n.issue);
    }
    // A missing optional field is a correct answer, not a doubtful one.
    if (value !== null && confidence < threshold) issues.push("low_confidence");

    fields[name] = { value, normalized, confidence, status: "accepted", issues };
  }

  // Cross-field checks: the model can be confident about each number and still
  // read one of them wrong. Arithmetic catches that.
  const money = (k: string) => (typeof fields[k]?.normalized === "number" ? (fields[k]!.normalized as number) : null);
  const sub = money("subtotal"), tax = money("tax"), total = money("total");
  if (sub !== null && tax !== null && total !== null && Math.abs(sub + tax - total) > 1) {
    for (const k of ["subtotal", "tax", "total"]) fields[k]!.issues.push("totals_mismatch");
  }

  const date = (k: string) => (typeof fields[k]?.normalized === "string" ? (fields[k]!.normalized as string) : null);
  const order = (a: string, b: string) => {
    const da = date(a), db = date(b);
    if (da && db && db < da) {
      fields[a]!.issues.push("dates_out_of_order");
      fields[b]!.issues.push("dates_out_of_order");
    }
  };
  if (type === "invoice") order("issue_date", "due_date");
  if (type === "certificate") {
    order("issue_date", "expiry_date");
    const exp = date("expiry_date");
    if (exp && exp < today) flags.push("expired");
  }

  let decision: Validated["decision"] = "accepted";
  for (const f of Object.values(fields)) {
    if (f.issues.length) {
      f.status = "needs_review";
      decision = "needs_review";
    }
  }
  return { decision, fields, flags };
}
