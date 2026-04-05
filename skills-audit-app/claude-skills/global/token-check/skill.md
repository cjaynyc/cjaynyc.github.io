# token-check

## Description
Scan source files for raw hex colors and verify all colors use project design tokens.

## Trigger
TRIGGER when: user says "check tokens", "audit colors", "find hardcoded colors", "token check", or asks to verify design token usage

## References
- Project design token file for canonical token definitions
- Project CLAUDE.md for color-to-token mapping

## Steps
1. Determine scope: use the file or directory the user specifies, or default to `src/**/*.tsx`
2. Locate the project's design token file (e.g., `tokens.ts`, `tokens.css`, `theme.ts`)
3. Build a hex-to-token mapping from the token file
4. Scan all matching files for raw hex color patterns (`#XXXXXX` or `#XXX`) in style properties, inline styles, and CSS
5. For each violation found:
   - Report the file path, line number, and the raw hex value
   - Suggest the matching project design token based on the token mapping
   - For hex values not in the standard mapping, find the closest token by color distance
6. Report summary: total files scanned, total violations found, list of suggested fixes
7. If the user confirms, apply the fixes automatically

## Notes
- Hex values inside the token definition file itself are expected and should be excluded from violation reports
- Also check for `rgb()` and `rgba()` color values that should use tokens
- Case-insensitive matching for hex values (e.g., `#acacac` and `#ACACAC` are the same)
- The token file is the canonical source — always cross-reference it for the complete mapping
