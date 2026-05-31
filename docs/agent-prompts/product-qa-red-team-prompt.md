# Product QA Red-Team Prompt

```text
Act as an adversarial product QA reviewer for Astra.

Assume the target user is a non-technical Chinese learner who does not understand provider, model, API key, token, quota, or relay.

Test the product path mentally and with code evidence where possible:
1. First open/sample lesson.
2. Webpage reading and selection save.
3. Supported video subtitle/transcript save.
4. Today Review.
5. Library/recently saved.
6. Mobile companion review.
7. Free-to-Pro value prompt.
8. Error and empty states.

Find:
- 5 places where the user may get stuck.
- 5 places where copy is too technical or overclaims support.
- 5 places where save/review/source context can break.
- 5 features that should be cut/deferred to avoid scope creep.

For each finding, include severity, affected surface, likely file/component, and the smallest fix.
```
