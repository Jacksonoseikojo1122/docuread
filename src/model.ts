import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { FIELDS, extractionSchema, type DocType, type DocumentInput, type RawExtraction } from "./schemas.js";

export type ModelResult =
  | { ok: true; extraction: RawExtraction; model: string; usage: { input: number; output: number } }
  | { ok: false; reason: "refused" | "unparseable"; detail: string; model: string };

/** Anything that can read a document. The real one calls Claude; tests use a fake. */
export interface ExtractionModel {
  readonly name: string;
  extract(doc: DocumentInput, type: DocType): Promise<ModelResult>;
}

const SYSTEM = `You read business documents and copy out specific fields exactly as they are printed.

Rules:
- Copy what is on the page. Never guess, calculate or fill in a value that is not printed. If a field is not on the document, return null.
- Dates: return YYYY-MM-DD. If the day/month order is ambiguous, pick the reading that matches the country on the document and lower your confidence.
- Money: return a plain decimal number with no currency symbol or thousands separator, e.g. 1250.50.
- Currency: return the ISO 4217 code (GHS for cedis / GH₵, USD for $ when the document is American, etc.).
- confidence is your honest probability (0 to 1) that the value is exactly right. Use low values when text is blurred, cut off, handwritten or ambiguous. A wrong value with high confidence is the worst outcome.
- notes: one short sentence about anything unusual (damage, multiple totals, a second currency). Empty string if nothing.`;

function userPrompt(type: DocType) {
  const lines = Object.entries(FIELDS[type]).map(([name, f]) => `- ${name}: ${f.hint}`);
  return `This is a ${type}. Extract these fields:\n${lines.join("\n")}`;
}

function documentBlock(doc: DocumentInput): Anthropic.Beta.BetaContentBlockParam {
  if (doc.mediaType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.data } };
  }
  return { type: "image", source: { type: "base64", media_type: doc.mediaType, data: doc.data } };
}

export class ClaudeModel implements ExtractionModel {
  readonly name: string;
  private client: Anthropic;

  constructor(opts: { model?: string; client?: Anthropic } = {}) {
    this.name = opts.model ?? process.env.DOCUREAD_MODEL ?? "claude-opus-5-5";
    this.client = opts.client ?? new Anthropic();
  }

  async extract(doc: DocumentInput, type: DocType): Promise<ModelResult> {
    const response = await this.client.beta.messages.parse({
      model: this.name,
      max_tokens: 4000,
      // If the model declines for policy reasons, the API retries on its
      // server-defined fallback model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "medium", format: betaZodOutputFormat(extractionSchema(type)) },
      messages: [{ role: "user", content: [documentBlock(doc), { type: "text", text: userPrompt(type) }] }],
    });

    if (response.stop_reason === "refusal") {
      return {
        ok: false,
        reason: "refused",
        detail: response.stop_details?.explanation ?? "The model declined to read this document.",
        model: response.model,
      };
    }
    if (!response.parsed_output) {
      return { ok: false, reason: "unparseable", detail: `stop_reason=${response.stop_reason}`, model: response.model };
    }
    return {
      ok: true,
      extraction: response.parsed_output as RawExtraction,
      model: response.model,
      usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    };
  }
}
