# How Privacy Mode works

Privacy Mode is for situations where Astra should be more conservative about memory, personalization, and outbound detail.

When Privacy Mode is on, Astra should prefer local or in-product summaries and reduce or suppress optional outbound delivery. For example, digest email or notification behavior must stay optional and constrained before any stronger delivery claim is made.

Support and telemetry boundaries:

- Support bundles should use metadata by default.
- Full URLs, page text, selected text, transcripts, prompts, model output, and screenshots are not included by default.
- Metrics should use aggregate counts and coarse source types where possible.

Privacy Mode is not a substitute for account deletion or legal data requests. Use the data deletion help path for export/delete questions.
