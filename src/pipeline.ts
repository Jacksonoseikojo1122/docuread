import { randomUUID } from "node:crypto";
import type { ExtractionModel } from "./model.js";
import type { ReviewStore } from "./review.js";
import type { DocType, DocumentInput } from "./schemas.js";
import { validate, type FieldResult, type ValidateOptions } from "./validate.js";

export type ExtractResult =
  | {
      id: string;
      type: DocType;
      decision: "accepted" | "needs_review";
      fields: Record<string, FieldResult>;
      flags: string[];
      notes: string;
      model: string;
    }
  | { id: string; type: DocType; decision: "rejected"; reason: string; model: string };

export async function processDocument(
  doc: DocumentInput,
  type: DocType,
  deps: { model: ExtractionModel; store?: ReviewStore },
  opts: ValidateOptions = {},
): Promise<ExtractResult> {
  const id = randomUUID();
  const out = await deps.model.extract(doc, type);
  if (!out.ok) return { id, type, decision: "rejected", reason: `${out.reason}: ${out.detail}`, model: out.model };

  const v = validate(type, out.extraction, opts);
  if (v.decision === "needs_review" && deps.store) {
    await deps.store.add({
      id,
      type,
      createdAt: new Date().toISOString(),
      status: "pending",
      fields: v.fields,
      notes: out.extraction.notes,
    });
  }
  return { id, type, decision: v.decision, fields: v.fields, flags: v.flags, notes: out.extraction.notes, model: out.model };
}
