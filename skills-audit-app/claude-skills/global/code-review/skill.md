# code-review

## Description
Review code or a pull request for bugs, security issues, and project design system compliance.

## Trigger
TRIGGER when: user asks to review code, a PR, or a diff

## References
- Project design token file for canonical color tokens
- `.eslintrc` or ESLint config in the project
- Project design conventions in CLAUDE.md or .carl files

## Steps
1. Read the diff, PR contents, or specified files
2. Check for bugs, security issues, and logic errors
3. Check for performance issues and unnecessary re-renders
4. Run project-specific design system checks:
   - **Raw hex colors**: Any `#XXXXXX` in style props must use project design tokens instead
   - **Emoji in JSX**: Never use emoji for icons — must use the project icon system
   - **Non-approved fonts**: Only project-approved font families and weights allowed
   - **Non-standard border-radius**: Only values from the project spacing/radius scale are valid
   - **Non-standard spacing**: Only values from the project spacing scale for padding/margin/gap
   - **Left border accent bars**: Flag colored left borders on cards, rows, accordions, or list items (common AI anti-pattern)
   - **console.log in TSX**: Flag any console.log statements in component files
   - **Date format**: Must follow project date format conventions
   - **Currency format**: Must follow project currency format conventions
   - **Odd font sizes**: Only project-approved font sizes allowed
5. Provide feedback organized by severity: critical, warning, suggestion

## Notes
- Focus on actionable feedback with specific file and line references
- For each raw hex violation, suggest the matching project design token
- Do not nitpick formatting that ESLint already handles
- Check project CLAUDE.md for any additional project-specific rules (font weights, icon systems, etc.)
