# code-review

## Description
Review a pull request or code diff for bugs, style issues, and potential improvements, then provide structured feedback.

## Trigger
TRIGGER when: user asks to review code, a PR, or a diff

## References
- Project-specific linting rules
- .eslintrc or pyproject.toml if present

## Steps
1. Read the diff or PR contents
2. Check for bugs, security issues, and logic errors
3. Check for style consistency and naming conventions
4. Identify potential performance issues
5. Provide feedback organized by severity (critical, suggestion, nitpick)

## Notes
Focus on actionable feedback. Avoid nitpicking formatting if a linter handles it.
