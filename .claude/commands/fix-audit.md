Read the latest audit report from skills-audit-app/audit-reports/ and auto-fix each flagged issue.

Steps:
1. Find the most recent JSON file in `skills-audit-app/audit-reports/`
2. Read the report and list all issues found
3. For each issue:
   - **Overlap**: Draft a rewritten description for one or both skills to make them clearly distinct. Show me the before/after and ask: accept, reject, or edit.
   - **Vague/Incomplete**: Draft an improved description or trigger. Show me the before/after and ask: accept, reject, or edit.
4. After I approve a fix, write the updated skill.md file
5. After all issues are resolved, run `python skills-audit-app/audit.py --all` to verify the fixes worked
6. If all clean, commit the changes with a descriptive message
