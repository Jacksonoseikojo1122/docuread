import { z } from "zod";

export const DOC_TYPES = ["receipt", "invoice", "certificate"] as const;
export type DocType = (typeof DOC_TYPES)[number];

/** How a field's raw text is checked and normalised. */
export type FieldKind = "text" | "date" | "money" | "currency";

type FieldSpec = { kind: FieldKind; required: boolean; hint: string };

export const FIELDS: Record<DocType, Record<string, FieldSpec>> = {
  receipt: {
    merchant_name: { kind: "text", required: true, hint: "Business name as printed at the top" },
    date: { kind: "date", required: true, hint: "Date of purchase" },
    currency: { kind: "currency", required: true, hint: "ISO 4217 code, e.g. GHS, USD" },
    subtotal: { kind: "money", required: false, hint: "Amount before tax" },
    tax: { kind: "money", required: false, hint: "Total tax or VAT/levies" },
    total: { kind: "money", required: true, hint: "Final amount paid" },
  },
  invoice: {
    invoice_number: { kind: "text", required: true, hint: "Invoice number or reference" },
    issuer_name: { kind: "text", required: true, hint: "Business that issued the invoice" },
    customer_name: { kind: "text", required: false, hint: "Who the invoice is billed to" },
    issue_date: { kind: "date", required: true, hint: "Date the invoice was issued" },
    due_date: { kind: "date", required: false, hint: "Date payment is due" },
    currency: { kind: "currency", required: true, hint: "ISO 4217 code" },
    subtotal: { kind: "money", required: false, hint: "Amount before tax" },
    tax: { kind: "money", required: false, hint: "Total tax" },
    total: { kind: "money", required: true, hint: "Total amount due" },
  },
  certificate: {
    holder_name: { kind: "text", required: true, hint: "Person the certificate was issued to" },
    certificate_type: { kind: "text", required: true, hint: "What the certificate is for, e.g. CPR, First Aid" },
    issuer: { kind: "text", required: true, hint: "Organisation that issued it" },
    certificate_number: { kind: "text", required: false, hint: "Certificate or licence number" },
    issue_date: { kind: "date", required: true, hint: "Date issued" },
    expiry_date: { kind: "date", required: false, hint: "Expiry date; null if the document has none" },
  },
};

export const fieldNames = (type: DocType) => Object.keys(FIELDS[type]);

/**
 * What the model must return. Every field is a value plus the model's own
 * confidence. Values come back as printed text; the validator does the
 * parsing, so a model mistake can never smuggle in a malformed number.
 */
const field = z.object({
  value: z.string().nullable(),
  confidence: z.number(),
});

export function extractionSchema(type: DocType) {
  const shape = Object.fromEntries(fieldNames(type).map((name) => [name, field]));
  return z.object({
    fields: z.object(shape),
    notes: z.string(),
  });
}

export type RawField = z.infer<typeof field>;
export type RawExtraction = { fields: Record<string, RawField>; notes: string };

export const MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export type DocumentInput = { mediaType: MediaType; data: string /* base64, no newlines */ };
