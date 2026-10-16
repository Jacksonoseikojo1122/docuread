/**
 * Runs every eval case through the real pipeline and scores it.
 *   npm run eval                 -> real model (needs Anthropic credentials; costs money)
 *   npm run eval -- --fake       -> fake model, free; checks the harness itself
 *   npm run eval -- --baseline   -> also save this run as the new baseline
 * Exits 1 if the run is worse than eval/baseline.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ClaudeModel, type ExtractionModel } from "../src/model.js";
import { processDocument } from "../src/pipeline.js";
import { FakeModel } from "../test/fake-model.js";
import { CASES } from "./cases.js";
import { regressions, scoreCase, summarize, type CaseOutcome, type Summary } from "./score.js";

const args = new Set(process.argv.slice(2));
const TODAY = "2026-10-16"; // pinned so "expired" means the same thing on every run
const model: ExtractionModel = args.has("--fake") ? FakeModel.fromCases(CASES) : new ClaudeModel();

const outcomes: CaseOutcome[] = [];
for (const c of CASES) {
  const data = readFileSync(join("eval/fixtures", `${c.id}.png`)).toString("base64");
  const started = Date.now();
  const r = await processDocument({ mediaType: "image/png", data }, c.type, { model }, { today: TODAY });
  const o = scoreCase(c, r, TODAY);
  outcomes.push(o);
  const wrong = o.fields.filter((f) => !f.correct);
  console.log(
    `${o.decision.padEnd(12)} ${c.id.padEnd(26)} ${String(o.fields.length - wrong.length).padStart(2)}/${o.fields.length} correct  ${Date.now() - started}ms` +
      (wrong.length ? `  wrong: ${wrong.map((f) => `${f.field}${f.accepted ? "(ACCEPTED)" : ""}`).join(", ")}` : ""),
  );
}

const summary = summarize(outcomes);
console.log("\n", summary);

mkdirSync("eval/results", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(join("eval/results", `${stamp}.json`), JSON.stringify({ model: model.name, summary, outcomes }, null, 2));

const report = [
  `# DocuRead eval report`,
  ``,
  `Model: \`${model.name}\` · ${summary.cases} documents · ${summary.fields} fields · run ${new Date().toISOString().slice(0, 10)}`,
  ``,
  `| Metric | Value |`,
  `| --- | --- |`,
  `| Field accuracy | ${summary.accuracy}% |`,
  `| **Silent errors** (wrong and accepted) | **${summary.silentErrors}** (${summary.silentErrorRate}%) |`,
  `| Errors caught by review | ${summary.caughtErrors} |`,
  `| Documents sent to review | ${summary.reviewRate}% |`,
  `| Must-review documents caught | ${summary.mustReviewRecall}% |`,
  `| Expiry flag correct | ${summary.expiryFlagAccuracy}% |`,
  ``,
  `| Case | Decision | Wrong fields |`,
  `| --- | --- | --- |`,
  ...outcomes.map((o) => {
    const wrong = o.fields.filter((f) => !f.correct);
    return `| ${o.id} | ${o.decision} | ${wrong.length ? wrong.map((f) => `${f.field}: got \`${f.got}\`, expected \`${f.expected}\`${f.accepted ? " **(accepted)**" : ""}`).join("<br>") : "none"} |`;
  }),
].join("\n");
if (!args.has("--fake")) writeFileSync("eval/REPORT.md", report + "\n");

const basePath = "eval/baseline.json";
if (args.has("--baseline")) {
  writeFileSync(basePath, JSON.stringify({ model: model.name, summary }, null, 2));
  console.log("Saved as baseline.");
} else if (existsSync(basePath) && !args.has("--fake")) {
  const base = JSON.parse(readFileSync(basePath, "utf8")) as { summary: Summary };
  const r = regressions(summary, base.summary);
  if (r.length) {
    console.error("REGRESSION:\n- " + r.join("\n- "));
    process.exit(1);
  }
  console.log("No regression against baseline.");
}
