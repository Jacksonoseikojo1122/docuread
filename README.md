# DocuRead

Turn receipts, invoices and certificates into clean JSON, with a confidence score and a human review queue.

> **Status: in development.** I'm building this in public. Follow along here or on the project page:
> **https://jacksonkojoosei.com/projects/docuread**

## What it does

Send a photo or PDF, get structured data back. Anything the model is unsure about goes to a review queue instead of straight into your database. It grew out of the licence check I built for a US healthcare platform.

## Why

AI models read documents well most of the time and confidently wrong some of the time. Without a way to measure that and catch the wrong answers, you can't trust them with real decisions.

## Planned features

- [ ] Document to JSON against a schema you define
- [ ] Confidence per field, with low-confidence fields sent for review
- [ ] Evaluation suite: a labelled test set and an accuracy score on every change
- [ ] Rules that override the model where you know better
- [ ] Rate limits and cost tracking per API key

## Stack

TypeScript, Node.js, Claude API, PostgreSQL, Next.js

## Author

Built by **[Jackson Kojo Osei](https://jacksonkojoosei.com)**, CTO in Accra, Ghana.
[LinkedIn](https://www.linkedin.com/in/jackson-kojo-osei-740846189) · [All projects](https://jacksonkojoosei.com/projects)

## License

MIT
