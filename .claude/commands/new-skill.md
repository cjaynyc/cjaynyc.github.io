Create a new skill in the claude-skills directory.

Ask me:
1. **Name** (kebab-case, e.g., "send-reminder")
2. **Scope**: Global or Project? If project, which project?
3. **Description** (1-2 sentences — be specific enough to avoid overlap)
4. **Trigger** (format: "TRIGGER when: <condition>")
5. **Steps** (the repeatable procedure)
6. **References** (optional: templates, files, URLs)
7. **Notes** (optional: edge cases, related skills)

Then:
1. Create the skill.md file at the correct path (`skills-audit-app/claude-skills/global/<name>/skill.md` or `skills-audit-app/claude-skills/projects/<project>/<name>/skill.md`)
2. Run a quick audit (`python skills-audit-app/audit.py --all`) to check if the new skill overlaps with existing ones
3. If overlap detected, suggest rewording before committing
4. If clean, commit the new skill
