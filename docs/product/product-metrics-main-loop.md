# Astra Product Metrics: Main Learning Loop

Astra should not optimize only for translation requests. The product metric should show whether users turn real content into reviewable learning moments.

## North-star metric

```text
Weekly Reviewable Learning Moments
```

Definition:

> Count of user-saved expressions/moments in a week that keep source context and either enter Review or are revisited from Library.

## Main funnel

```text
install/open
  → first_understood_content
  → first_saved_expression
  → first_review_card_created
  → first_review_completed
  → next_day_review_return
```

## Event definitions

| Event | Meaning | Success signal |
|---|---|---|
| `first_understood_content` | User saw a translated/explained page, selection, sample, or supported video line | Activation |
| `first_saved_expression` | User saved a word/sentence/video moment | Learning intent |
| `first_review_card_created` | Saved item produced a reviewable card | Loop integrity |
| `first_review_completed` | User completed at least one review session | First habit |
| `next_day_review_return` | User returned to review after a day boundary | Retention |
| `source_return_from_review` | User jumped from card back to source page/video | Source-backed value |
| `video_moment_saved` | User saved a timestamp-backed video moment | Video differentiation |
| `library_recent_saved_opened` | User opened recently saved/library after saving | Learning history value |

## Supporting metrics

### Web reading

- page translation started;
- first visible content translated;
- partial success shown;
- selection explain used;
- selection saved for review;
- fallback used after page limitation.

### Supported video

- supported video detected;
- captions available;
- transcript panel opened;
- transcript line saved;
- timestamp-backed review card opened;
- no-caption fallback used.

### Review

- due cards shown;
- review started;
- Again / Good / Easy selected;
- review completed;
- completion next action clicked.

### Library

- recently saved opened;
- source detail opened;
- search used;
- card returned to source.

## Quality metrics

- user-visible failure rate;
- technical-copy exposure count;
- unsupported-page fallback rate;
- unsupported-video/no-caption fallback rate;
- save-to-card conversion failure rate.

## Guardrail metrics

A product increase is not healthy if it increases:

- ordinary UI exposure to provider/model/API/quota language;
- pages/videos marketed as universally supported;
- saves that never become review cards;
- review cards without source context;
- support reports containing unnecessary content text.

## Stage OKRs

### P0

- New users can complete first_understood_content → first_saved_expression → first_review_completed in one session.
- Save-to-review card creation is reliable for webpage selections and supported video moments.
- Ordinary technical-copy exposure in changed public surfaces is zero.

### P1

- Users who save items can return to review the next day.
- Video moment saves can be reviewed with timestamp/source context.
- Library recently-saved usage increases after save events.

### P2

- Weekly Reviewable Learning Moments becomes the primary product dashboard metric.
- Weekly digest summarizes saved/reviewed learning moments without copying full third-party content.
