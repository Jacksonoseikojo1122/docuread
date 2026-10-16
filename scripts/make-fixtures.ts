/**
 * Renders each eval case to a PNG with headless Edge or Chrome, so the eval
 * runs on real pixels rather than on text. Run once; the PNGs are committed.
 *   npm run fixtures
 * Set BROWSER to the path of chrome/msedge if it isn't found automatically.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CASES, type Case } from "../eval/cases.js";

const OUT = resolve("eval/fixtures");
const CANDIDATES = [
  process.env.BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean) as string[];
const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) throw new Error("No Chrome/Edge found. Set BROWSER=/path/to/browser");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const row = (k: string, v: string) => (v ? `<tr><td>${esc(k)}</td><td class="v">${esc(v)}</td></tr>` : "");

function body(c: Case) {
  const p = c.printed;
  if (c.type === "receipt") {
    return `<div class="receipt"><h1>${esc(p.merchant!)}</h1><p class="small">Thank you for shopping with us</p>
      <p>Date: <span class="v">${esc(p.date!)}</span></p><hr/>
      <table>${row("Subtotal", p.subtotal ? `${p.currency} ${p.subtotal}` : "")}
      ${row(p.tax?.startsWith("Levies") ? "Levies & VAT" : "Tax", p.tax ? `${p.currency} ${p.tax.replace("Levies & VAT ", "")}` : "")}
      <tr class="total"><td>TOTAL</td><td class="v">${esc(p.currency!)} ${esc(p.total!)}</td></tr></table>
      <p class="small">Keep this receipt for returns</p></div>`;
  }
  if (c.type === "invoice") {
    return `<div class="invoice"><div class="top"><h1>${esc(p.issuer!)}</h1><h2>INVOICE</h2></div>
      <table class="meta">${row("Invoice no.", p.number!)}${row("Bill to", p.customer!)}${row("Issue date", p.issue!)}${row("Due date", p.due!)}</table>
      <table class="lines"><tr><th>Description</th><th>Amount</th></tr><tr><td>Services rendered</td><td class="v">${esc(p.currency!)} ${esc(p.subtotal!)}</td></tr></table>
      <table class="sum">${row("Subtotal", `${p.currency} ${p.subtotal}`)}${row("Tax", `${p.currency} ${p.tax}`)}
      <tr class="total"><td>Total due</td><td class="v">${esc(p.currency!)} ${esc(p.total!)}</td></tr></table></div>`;
  }
  return `<div class="cert"><p class="issuer">${esc(p.issuer!)}</p><h1>Certificate of Completion</h1>
    <p>This certifies that</p><p class="holder hand">${esc(p.holder!)}</p>
    <p>has successfully completed</p><p class="ctype">${esc(p.ctype!)}</p>
    <table class="meta">${row("Certificate no.", p.number!)}${row("Date of issue", p.issue!)}${row("Valid until", p.expiry!)}</table></div>`;
}

const CSS = `
  body{margin:0;background:#ddd;font-family:Arial,sans-serif;color:#111;display:flex;justify-content:center;padding:30px}
  .receipt{width:340px;background:#fff;padding:24px;font-family:'Courier New',monospace;font-size:15px}
  .receipt h1{font-size:20px;text-align:center;margin:0 0 4px}.small{font-size:11px;text-align:center;color:#555}
  .invoice{width:640px;background:#fff;padding:36px}.invoice .top{display:flex;justify-content:space-between;align-items:center}
  .cert{width:700px;background:#fffdf3;padding:48px;border:10px double #8a6d2b;text-align:center;font-family:Georgia,serif}
  .cert h1{font-size:34px;margin:8px 0}.holder{font-size:30px;margin:6px 0}.ctype{font-size:22px;font-weight:bold}
  table{width:100%;border-collapse:collapse;margin:10px 0}td,th{padding:4px 2px;text-align:left}td.v{text-align:right}
  .total td{font-weight:bold;border-top:2px solid #111;font-size:17px}
  .faded{filter:contrast(.35) brightness(1.25)}
  .skewed{transform:rotate(-4deg) translateY(10px)}
  .handwritten .hand,.handwritten .v{font-family:'Segoe Print','Comic Sans MS',cursive;color:#1d3c8f}
`;

mkdirSync(OUT, { recursive: true });
for (const c of CASES) {
  const htmlPath = join(OUT, `${c.id}.html`);
  const pngPath = join(OUT, `${c.id}.png`);
  writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="${c.style ?? ""}">${body(c)}</div></body></html>`);
  const size = c.type === "receipt" ? "460,620" : c.type === "invoice" ? "760,720" : "860,760";
  execFileSync(browser, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--window-size=${size}`, `--screenshot=${pngPath}`, `file:///${htmlPath.replace(/\\/g, "/")}`], { stdio: "ignore" });
  console.log("wrote", pngPath);
}
