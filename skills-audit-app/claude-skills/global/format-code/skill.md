# format-code

## Description
Format and lint code files using the project linter and design system conventions.

## Trigger
TRIGGER when: user asks to format, lint, or clean up code style

## References
- `.eslintrc` or ESLint config in the project
- Project design token file for color tokens
- `package.json` for available lint scripts

## Steps
1. Run `npm run lint` to check for linting violations
2. If auto-fixable, run `npm run lint -- --fix` to apply fixes
3. Check for project-specific formatting issues:
   - Font sizes must follow the project type scale
   - Spacing values must use the project spacing scale
   - Border-radius must use project-approved values
   - Colors must reference project design tokens, not raw hex
4. Report what changed and any remaining issues that need manual fixes

## Notes
- Use the project's established linter (ESLint, Prettier, etc.) — do not introduce new tools
- Do not introduce Prettier if the project does not already use it
- Check project CLAUDE.md for additional formatting constraints (font weights, spacing scales, etc.)
