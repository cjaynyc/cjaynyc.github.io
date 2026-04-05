Run the Skills Audit tool to scan all claude-skills/ for overlaps and vague descriptions.

Steps:
1. Run `python skills-audit-app/audit.py --all` and show the results
2. If issues are found, ask if I want to save the report
3. If saved, tell me I can run `/fix-audit` to auto-fix the flagged issues
4. If no issues found, confirm all skills are clean
