/**
 * Builds the images used in the README and docs: each sample document next to
 * the response DocuRead returns for it. The rule checks and review decisions
 * are produced by the real pipeline; the field values and confidences come
 * from the fake model until a real eval run replaces them (set DOCS_REAL=1 and
 * ANTHROPIC_API_KEY to render from the real model).
 *   npm run docs:images
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ClaudeModel, type ExtractionModel } from "../src/model.js";
import { processDocument } from "../src/pipeline.js";
import { FakeModel } from "../test/fake-model.js";
import { CASES } from "../eval/cases.js";

const OUT = resolve("docs/images");
const browser = [
  process.env.BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p) => p && existsSync(p));
if (!browser) throw new Error("Set BROWSER to a Chrome/Edge path");

const real = process.env.DOCS_REAL === "1";
const SHOW = ["receipt-gh-supermarket", "receipt-bad-totals", "invoice-gh-services", "cert-expired"];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function color(s: string) {
  return s
    .replace(/"(accepted)"/g, '<b class="ok">"$1"</b>')
    .replace(/"(needs_review)"/g, '<b class="warn">"$1"</b>')
    .replace(/"(totals_mismatch|low_confidence|dates_out_of_order|missing_required|invalid_[a-z]+|expired)"/g, '<b class="bad">"$1"</b>');
}

/** Valid JSON, but one line per field so a whole response fits in one image. */
function json(result: unknown) {
  const r = result as { fields?: Record<string, unknown> } & Record<string, unknown>;
  if (!r.fields) return color(esc(JSON.stringify(result, null, 2)));
  const top = Object.entries(r).filter(([k]) => k !== "fields").map(([k, v]) => `  "${k}": ${JSON.stringify(v)},`);
  const tidy = (v: unknown) => JSON.stringify(v).replace(/":/g, '": ').replace(/,"/g, ', "');
  const fields = Object.entries(r.fields).map(([k, v], i, a) => `    "${k}": ${tidy(v)}${i < a.length - 1 ? "," : ""}`);
  return color(esc(["{", ...top, '  "fields": {', ...fields, "  }", "}"].join("\n")));
}

mkdirSync(OUT, { recursive: true });
for (const id of SHOW) {
  const c = CASES.find((x) => x.id === id)!;
  const model: ExtractionModel = real ? new ClaudeModel() : FakeModel.fromCases([c]);
  const png = readFileSync(join("eval/fixtures", `${id}.png`)).toString("base64");
  const r = await processDocument({ mediaType: "image/png", data: png }, c.type, { model }, { today: "2026-10-16" });
  const shown =
    r.decision === "rejected"
      ? r
      : {
          decision: r.decision,
          flags: r.flags,
          fields: Object.fromEntries(
            Object.entries(r.fields).map(([k, f]) => [k, { normalized: f.normalized, confidence: f.confidence, status: f.status, issues: f.issues }]),
          ),
        };

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#0e0d0b;font-family:Arial,sans-serif;color:#f3f0e6}
    .wrap{display:flex;gap:28px;padding:36px;align-items:flex-start}
    .doc{flex:0 0 36%;} .doc img{width:100%;height:520px;object-fit:cover;object-position:top;border-radius:4px;box-shadow:0 8px 30px rgba(0,0,0,.5)}
    .label{font:12px monospace;letter-spacing:.12em;text-transform:uppercase;color:#a09a89;margin:0 0 10px}
    pre{flex:1;margin:0;background:#16150f;border:1px solid #2a2820;border-radius:4px;padding:18px;font:13.5px/1.6 Consolas,monospace;white-space:pre;overflow:hidden;color:#d8d3c4}
    .ok{color:#3fb27f}.warn{color:#d9a441}.bad{color:#e0614c}
    .foot{padding:0 36px 26px;font:12px monospace;color:#6d6858}
  </style></head><body>
    <div class="wrap">
      <div class="doc"><p class="label">Input · ${esc(c.type)}</p><img src="data:image/png;base64,${png}"></div>
      <div style="flex:1"><p class="label">${real ? "DocuRead response" : "Example response"}</p><pre>${json(shown)}</pre></div>
    </div>
    <div class="foot">DocuRead · github.com/Jacksonoseikojo1122/docuread${real ? "" : " · confidences illustrative"}</div>
  </body></html>`;
  const htmlPath = join(OUT, `${id}.html`);
  writeFileSync(htmlPath, html);
  execFileSync(browser, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1700,660", `--screenshot=${join(OUT, `${id}.png`)}`, `file:///${htmlPath.replace(/\\/g, "/")}`], { stdio: "ignore" });
  console.log("wrote", id, r.decision);
}
