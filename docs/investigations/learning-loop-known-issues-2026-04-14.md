# Known learning-loop issues (severity)

| Sev | Issue | Mitigation |
|-----|-------|------------|
| Resolved 2026-05-18 | `learning-loop` lane not in required CI | Closed by CI/release-policy alignment; `learning-loop` now blocks in `CI / live-browser` |
| S3 | Popup vs review progress UI uses different abstractions (page loop vs SRS session) | Documented in claim-impact |
| S3 | Long context in vocabulary **list** still truncated at 200 chars | Expanded path: review back + expand, or open expanded row |
