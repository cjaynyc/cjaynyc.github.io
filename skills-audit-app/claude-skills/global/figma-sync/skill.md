# figma-sync

## Description
Translate a Figma design into production code by reading design context, mapping colors to project tokens, and implementing with 1:1 visual fidelity.

## Trigger
TRIGGER when: user provides a Figma URL, says "implement this design", "sync from Figma", "build this from Figma", or references a Figma node to implement

## References
- Project design token file for color token mapping
- Figma MCP read tools: `mcp__figma__get_design_context`, `mcp__figma__get_screenshot`, `mcp__figma__get_metadata`, `mcp__figma__get_variable_defs`
- Figma MCP write tool: `mcp__figma__use_figma` (load figma-use skill first)

## Steps
1. Extract fileKey and nodeId from the Figma URL (convert `-` to `:` in nodeId)
2. Call `get_design_context` with fileKey and nodeId to get structured design data and reference code
3. Call `get_screenshot` for the same node to get a visual reference
4. Map all Figma hex colors to the nearest project design token — never hardcode raw hex values
5. Implement the component using the target project's styling convention (inline styles, CSS modules, Tailwind, etc. as established in the project)
6. Use the project icon system for all icons — never use emoji
7. Use project-approved fonts and weights only
8. Compare the implementation visually against the Figma screenshot for 1:1 parity
9. Iterate on any discrepancies until the output matches the design

## Notes
- Never use the Desktop Bridge — all Figma access goes through official MCP tools only
- Always call `get_design_context` before writing any code — never implement from a screenshot alone
- The reference code from `get_design_context` is a starting point, not final code — always adapt to the project's stack and conventions
- Use project-approved spacing and border-radius scales
- Check project CLAUDE.md for project-specific design rules and token mappings
