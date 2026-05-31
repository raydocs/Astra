# Review card quality eval

Purpose: check that saved real-world English becomes useful, source-backed Review cards without turning Astra into a complex Anki clone.

## Fixtures

Evaluate at least these card types:

1. **Web sentence card** — saved from a normal article paragraph.
2. **Web word card** — saved from selected text with page title and safe source URL.
3. **Supported-video moment card** — saved from transcript/subtitle with timestamp and source title.
4. **Sample lesson card** — from the first-success sample path.
5. **Private/source-hidden card** — source title masked where privacy settings require it.

## Acceptance checks

- Front is concise and reviewable.
- Back contains translation or explanation that helps recall, not a raw dump.
- Source title/type is present when allowed.
- Source link is safe: pages strip tracking/query noise; supported videos keep the video id and timestamp.
- Review controls stay simple: Again / Good / Easy.
- Completion state tells the learner what happens next.
- No provider/model/API/token/quota/relay/debug/telemetry wording appears.

## Manual scoring

Score each card from 0–2:

- **0**: confusing, source missing, or not reviewable.
- **1**: understandable but weak context or next-step copy.
- **2**: clear front/back, source-backed, and easy to review in under 30 seconds.

Ship only when P0 fixtures score 2 and P1 fixtures score at least 1.
