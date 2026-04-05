# git-commit

## Description
Create a well-formatted git commit with a conventional commit message summarizing the staged changes.

## Trigger
TRIGGER when: user asks to commit changes or says "commit this"

## References
- https://www.conventionalcommits.org/

## Steps
1. Run `git status` to review all changes (staged and unstaged)
2. Run `git diff --staged` to understand what is being committed
3. Run `git log --oneline -5` to match the repo's commit message style
4. Stage specific files by name — never use `git add -A` or `git add .`
5. Draft a conventional commit message (feat, fix, refactor, docs, chore, etc.)
6. Present the message for approval before committing
7. Commit with the approved message, always including the co-author line:
   `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
8. Run `git status` after commit to verify success

## Notes
- Never push to remote without explicit user confirmation
- Never use `git add -A` or `git add .` — always stage specific files
- Never amend a previous commit unless the user explicitly requests it
- If a pre-commit hook fails, fix the issue and create a new commit (do not amend)
- Skip files that may contain secrets (.env, credentials, API keys)
