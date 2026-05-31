# Product PR Review Prompt

Use this prompt with Claude, GPT, RepoPrompt, or another reviewer when reviewing Astra product PRs.

```text
Review this Astra PR as a product-completeness reviewer, not just a code reviewer.

Focus on whether it improves the ordinary-user loop:
Open Astra → understand a real English page/video → save useful expressions → review later → feel progress.

Check:
1. Does the PR expose provider/model/API key/token/quota/relay/debug language to ordinary users?
2. Does it overclaim all websites, all videos, unlimited use, local-only, or no uploads?
3. Does it make save → review clearer or more reliable?
4. Do saved items keep source context?
5. Do errors and empty states tell users what to do next?
6. Does YouTube/video copy use supported videos / best-effort wording?
7. Are generated Safari/iOS resources or evidence files unrelated to the PR included?
8. Are the verification commands appropriate for the touched surfaces?

Return:
- Verdict: merge / merge with caveats / do not merge.
- Blockers with file references.
- Important non-blockers.
- Product-copy issues.
- Missing verification.
- Suggested PR body improvements.
```
