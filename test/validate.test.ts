import { describe, expect, it } from "vitest";
import { parseDate, parseMoney, validate } from "../src/validate.js";
import type { RawExtraction } from "../src/schemas.js";

const f = (value: string | null, confidence = 0.95) => ({ value, confidence });

const receipt = (over: Partial<Record<string, ReturnType<typeof f>>> = {}): RawExtraction => ({
  notes: "",
  fields: {
    merchant_name: f("Osu Fresh Mart"),
    date: f("2026-09-14"),
    currency: f("GHS"),
    subtotal: f("212.40"),
    tax: f("46.73"),
    total: f("259.13"),
    ...over,
  },
});

describe("parsers", () => {
  it("accepts real calendar dates only", () => {
    expect(parseDate("2026-02-28")).toBe("2026-02-28");
    expect(parseDate("2026-02-30")).toBeNull();
    expect(parseDate("14/09/2026")).toBeNull();
  });

  it("turns money into integer minor units", () => {
    expect(parseMoney("1,250.5")).toBe(125050);
    expect(parseMoney("0.07")).toBe(7);
    expect(parseMoney("12")).toBe(1200);
    expect(parseMoney("GH₵ 12")).toBeNull();
    expect(parseMoney("1.234")).toBeNull();
  });
});

describe("validate", () => {
  it("accepts a clean, confident, consistent receipt", () => {
    const v = validate("receipt", receipt());
    expect(v.decision).toBe("accepted");
    expect(v.fields.total!.normalized).toBe(25913);
    expect(v.fields.currency!.normalized).toBe("GHS");
  });

  it("sends a low-confidence field to review, and only that field", () => {
    const v = validate("receipt", receipt({ merchant_name: f("Osu Fresh Mart", 0.5) }));
    expect(v.decision).toBe("needs_review");
    expect(v.fields.merchant_name!.issues).toContain("low_confidence");
    expect(v.fields.total!.status).toBe("accepted");
  });

  it("catches totals that don't add up even when the model is confident", () => {
    const v = validate("receipt", receipt({ total: f("299.13", 0.99) }));
    expect(v.decision).toBe("needs_review");
    for (const k of ["subtotal", "tax", "total"]) expect(v.fields[k]!.issues).toContain("totals_mismatch");
  });

  it("allows one minor unit of rounding in totals", () => {
    expect(validate("receipt", receipt({ total: f("259.14") })).decision).toBe("accepted");
  });

  it("flags missing required fields but not missing optional ones", () => {
    const v = validate("receipt", receipt({ total: f(null), subtotal: f(null), tax: f(null) }));
    expect(v.fields.total!.issues).toEqual(["missing_required"]);
    expect(v.fields.subtotal!.issues).toEqual([]);
  });

  it("rejects malformed values from the model", () => {
    const v = validate("receipt", receipt({ date: f("14/09/2026"), currency: f("cedis"), total: f("GH₵259.13") }));
    expect(v.fields.date!.issues).toContain("invalid_date");
    expect(v.fields.currency!.issues).toContain("invalid_currency");
    expect(v.fields.total!.issues).toContain("invalid_money");
  });

  it("flags an invoice due before it was issued", () => {
    const v = validate("invoice", {
      notes: "",
      fields: {
        invoice_number: f("INV-88"), issuer_name: f("Coastline Prints"), customer_name: f(null),
        issue_date: f("2026-09-20"), due_date: f("2026-09-10"), currency: f("USD"),
        subtotal: f("300.00"), tax: f("0.00"), total: f("300.00"),
      },
    });
    expect(v.fields.due_date!.issues).toContain("dates_out_of_order");
  });

  it("marks expired certificates without sending them to review", () => {
    const v = validate(
      "certificate",
      {
        notes: "",
        fields: {
          holder_name: f("Yaw Darko"), certificate_type: f("Food Handler Permit"), issuer: f("Metro Health"),
          certificate_number: f("FHP-2210"), issue_date: f("2023-02-01"), expiry_date: f("2025-02-01"),
        },
      },
      { today: "2026-10-16" },
    );
    expect(v.flags).toContain("expired");
    expect(v.decision).toBe("accepted");
  });

  it("clamps out-of-range confidence", () => {
    const v = validate("receipt", receipt({ merchant_name: f("X", 7) }));
    expect(v.fields.merchant_name!.confidence).toBe(1);
  });
});
