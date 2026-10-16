import type { ExtractionModel, ModelResult } from "../src/model.js";
import type { DocType, DocumentInput, RawExtraction } from "../src/schemas.js";
import type { Case } from "../eval/cases.js";

/** A model that returns whatever you hand it. Free, deterministic, offline. */
export class FakeModel implements ExtractionModel {
  readonly name = "fake";
  constructor(private answer: (doc: DocumentInput, type: DocType) => RawExtraction | ModelResult) {}

  async extract(doc: DocumentInput, type: DocType): Promise<ModelResult> {
    const a = this.answer(doc, type);
    if ("ok" in a) return a;
    return { ok: true, extraction: a, model: this.name, usage: { input: 0, output: 0 } };
  }

  /** Answers each eval case from its known values, in the format the real model uses. */
  static fromCases(cases: Case[]) {
    let i = 0;
    return new FakeModel(() => {
      const c = cases[i++ % cases.length]!;
      const fields = Object.fromEntries(
        Object.entries(c.expected).map(([k, v]) => [
          k,
          { value: v === null ? null : typeof v === "number" ? (v / 100).toFixed(2) : v, confidence: 0.95 },
        ]),
      );
      return { fields, notes: "" };
    });
  }
}
