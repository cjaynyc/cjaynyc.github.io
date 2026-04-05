# git-commit

## Description
Create a well-formatted git commit with a conventional commit message that summarizes the staged changes.

## Trigger
TRIGGER when: user asks to commit changes or says "commit this"

## References
- https://www.conventionalcommits.org/

## Steps
1. Run git status to review staged changes
2. Run git diff --staged to understand what changed
3. Draft a commit message following conventional commit format
4. Present the message for approval
5. Run git commit with the approved message

## Notes
Does not push to remote — that requires explicit user confirmation.
