# format-code

## Description
Format code files according to the project's style configuration using the appropriate formatter.

## Trigger
TRIGGER when: user asks to format, lint, or clean up code style

## References
- .prettierrc, .eslintrc, pyproject.toml, or equivalent config files

## Steps
1. Detect the project language and formatter (Prettier, Black, gofmt, etc.)
2. Run the formatter on the specified files
3. Report what changed

## Notes
