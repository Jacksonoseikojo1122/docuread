// Run: DOCUREAD_KEY=my-secret-key npx tsx examples/node.ts eval/fixtures/invoice-gh-services.png invoice
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const [path = "eval/fixtures/receipt-gh-supermarket.png", type = "receipt"] = process.argv.slice(2);
const url = process.env.DOCUREAD_URL ?? "http://localhost:8787";

const form = new FormData();
form.set("type", type);
form.set("file", new Blob([await readFile(path)], { type: path.endsWith(".pdf") ? "application/pdf" : "image/png" }), basename(path));

const res = await fetch(`${url}/v1/extract`, {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.DOCUREAD_KEY ?? ""}` },
  body: form,
});
const result = (await res.json()) as {
  decision: string;
  fields?: Record<string, { normalized: unknown; status: string; issues: string[] }>;
  reason?: string;
};

console.log("decision:", result.decision);
for (const [name, f] of Object.entries(result.fields ?? {})) {
  console.log(`${f.status === "accepted" ? "✓" : "?"} ${name.padEnd(18)} ${String(f.normalized)}${f.issues.length ? `  (${f.issues.join(", ")})` : ""}`);
}
if (result.reason) console.log("reason:", result.reason);
