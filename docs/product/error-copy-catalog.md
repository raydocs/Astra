# Error copy catalog

Use this catalog when touching ordinary-user error states. Keep copy human, action-oriented, and free of provider/model/API/token/quota/relay/debug/telemetry wording.

| Situation | User-facing copy | Next action |
| --- | --- | --- |
| Page translation is starting | Astra is translating the visible part first. Keep reading. | Let the user continue instead of blocking the page. |
| Some page paragraphs failed | Some paragraphs need retry. | Offer retry for failed paragraphs only. |
| Supported video has no captions | Astra could not find captions for this supported video. Open the transcript panel to paste a line for explanation. | Offer paste-to-explain; do not claim all videos work. |
| Transcript is not ready | Transcript is not ready yet. Wait for captions, then open Deep Read again. | Wait or retry after captions load. |
| Save succeeds | Saved for review tonight. | Show Review now and Library destination. |
| Explanation feedback recorded | Thanks — saved as learning feedback. | Keep the learner in flow; do not ask for technical details. |
| Account status unavailable | Showing your most recent status until your Astra account refreshes. | Continue using available local learning surfaces. |
| Local file handoff missing | Astra could not find the one-time local handoff. Choose the same file again to continue. | Re-select the file. |

## Copy rules

- Name the supported surface: page, source, saved card, supported video, transcript, Review, Library.
- Always provide the next step.
- Never suggest that Astra stores full pages or full transcripts by default.
- Never expose backend routing or AI-service terminology to ordinary users.
