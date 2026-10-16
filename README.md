# DocuRead

Turn receipts, invoices and certificates into clean JSON, with a confidence score for every field and a human review queue for anything doubtful.

[![CI](https://github.com/Jacksonoseikojo1122/docuread/actions/workflows/ci.yml/badge.svg)](https://github.com/Jacksonoseikojo1122/docuread/actions/workflows/ci.yml)

Project page: **https://jacksonkojoosei.com/projects/docuread**

## Why

AI models read documents well most of the time and confidently wrong some of the time. If you let every answer straight into your database, the wrong ones go with them. DocuRead treats the model's answer as untrusted:

1. Claude reads the document and returns each field with its own confidence.
2. Code checks the answer: dates must be real dates, money must parse, `subtotal + tax` must equal `total`, an invoice can't be due before it was issued, an expiry can't come before the issue date.
3. Any field that fails a check, or that the model wasn't sure about, goes to a **review queue** instead of being accepted.
4. An **eval suite** measures how often a wrong answer slips through, so you can tell whether a new model or prompt made things better or worse.

It grew out of the licence and certificate check I built for a US healthcare staffing platform.

## The number that matters

The eval reports field accuracy, but the headline is **silent errors**: fields that were wrong *and* accepted. A wrong field that lands in the review queue is the system doing its job. A wrong field that gets through is the one that costs money.

## Quick start

```bash
npm install
cp .env.example .env        # add ANTHROPIC_API_KEY and DOCUREAD_API_KEYS
npm run dev                 # http://localhost:8787
```

```bash
curl -X POST http://localhost:8787/v1/extract \
  -H "Authorization: Bearer change-me" \
  -F type=receipt -F file=@eval/fixtures/receipt-gh-supermarket.png
```

Each field comes back as `{ value, normalized, confidence, status, issues }`, plus a document-level `decision` of `accepted` or `needs_review`. Money is returned as integer minor units (pesewas, cents) so totals compare exactly.

## API

| Method | Path | What it does |
| --- | --- | --- |
| `POST` | `/v1/extract` | Multipart `file` + `type`, or JSON `{type, media_type, data}` (base64). Types: `receipt`, `invoice`, `certificate`. PNG, JPEG, WebP, GIF or PDF. |
| `GET` | `/v1/review?status=pending` | Documents waiting for a person |
| `GET` | `/v1/review/:id` | One review item |
| `POST` | `/v1/review/:id/resolve` | `{corrections: {field: value}}` |
| `GET` | `/health` | Liveness and model name |

Every `/v1` call needs `Authorization: Bearer <key>`. Extract calls are rate-limited per key, because each one is a paid model call.

## Evals

```bash
npm run eval -- --fake      # free: checks the harness with a fake model
npm run eval                # real model, 12 documents
npm run eval -- --baseline  # save this run as the bar future runs must meet
```

The fixtures in `eval/fixtures` are synthetic documents (no real people or businesses) rendered to PNG by `npm run fixtures`. They include a faded thermal receipt, a photo taken at an angle, handwritten dates, a receipt whose printed totals don't add up, an invoice due before it was issued, and an expired certificate.

A run fails if silent errors rise, accuracy drops by more than 2 points, or a document that must be reviewed gets through. CI runs the harness with a fake model on every push; the real eval runs on demand from the Actions tab.

## Stack

TypeScript · Node.js · [Hono](https://hono.dev) · Claude API (vision, PDF input, structured outputs) · Zod · Vitest

## Roadmap

- [x] Receipts, invoices and certificates
- [x] Per-field confidence and rule checks
- [x] Review queue
- [x] Eval suite with regression check
- [ ] First published eval run and baseline
- [ ] Postgres review store
- [ ] Custom document schemas from a JSON definition
- [ ] Hosted demo

## Author

Built by **[Jackson Kojo Osei](https://jacksonkojoosei.com)**, CTO in Accra, Ghana. [LinkedIn](https://www.linkedin.com/in/jackson-kojo-osei-740846189) · [All projects](https://jacksonkojoosei.com/projects)

MIT licence.
