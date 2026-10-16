# Evals: knowing whether it works

Changing the model, the prompt or the threshold can make things better or worse in ways you won't notice by trying one or two documents. The eval runs every sample document through the real pipeline and scores the result.

```bash
npm run eval -- --fake      # free: checks the harness, no API calls
npm run eval                # real model on all 12 documents
npm run eval -- --baseline  # save this run as the bar future runs must meet
```

## What it measures

| Metric | Meaning |
| --- | --- |
| **Silent errors** | Fields that were wrong **and accepted**. The headline number. These are the mistakes that reach your database. |
| Errors caught by review | Fields that were wrong but sent to review. The system doing its job. |
| Field accuracy | Share of fields read correctly |
| Documents sent to review | How much manual work you're signing up for |
| Must-review documents caught | Documents that are wrong on paper (totals that don't add up, due before issued) and must reach a person |
| Expiry flag correct | Expired certificates flagged, valid ones not |

A run **fails** (exit code 1) if silent errors rise, accuracy falls by more than 2 points, or a must-review document gets through. The latest results are written to `eval/REPORT.md`.

## The sample documents

All synthetic, rendered from HTML by `npm run fixtures`, so no real person or business appears:

| File | What makes it hard |
| --- | --- |
| `receipt-gh-supermarket` | Cedi symbol (GH₵), VAT and levies on one line |
| `receipt-us-cafe` | Month-first date (09/03/2026) |
| `receipt-faded-fuel` | Faded thermal paper, no subtotal or tax |
| `receipt-bad-totals` | Printed totals don't add up |
| `invoice-gh-services` | Dates written out in words, thousands separators |
| `invoice-uk-consulting` | Pound sign, no customer name |
| `invoice-skewed` | Photographed at an angle |
| `invoice-due-before-issue` | Due date before issue date |
| `cert-cpr` | Long certificate type with punctuation |
| `cert-no-expiry` | No expiry and no number (both must be null) |
| `cert-handwritten` | Name and dates in handwriting |
| `cert-expired` | Expired: must be flagged |

## Adding your own cases

1. Add a case to `eval/cases.ts` with what's printed and the expected normalised values.
2. Run `npm run fixtures` to render it.
3. Run `npm run eval`.

To evaluate on your own real documents, put the files in `eval/fixtures/` with matching ids and skip step 2. Keep real documents out of public repos.

## Running it in CI

`.github/workflows/ci.yml` runs the free harness on every push. `.github/workflows/eval.yml` runs the real eval when you start it from the Actions tab; add `ANTHROPIC_API_KEY` as a repository secret first.
