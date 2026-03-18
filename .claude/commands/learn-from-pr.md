Extract lessons from a PR review and improve project standards. Argument: $ARGUMENTS (PR number or URL, or "last" for most recent reviewed PR).

## Steps

1. **Gather PR review findings**
   - If a PR number/URL is provided, fetch the review comments: `gh pr view <number> --comments`
   - If "last" or no argument, check the current conversation for review findings
   - If no findings anywhere, ask the user to provide the PR or paste findings

2. **Categorize each finding**
   For every issue raised in the review, classify it:
   - **Pattern violation** — existing standard was broken (→ strengthen the standard or add enforcement)
   - **Missing standard** — no rule existed to prevent this (→ add a new rule)
   - **Missing checklist item** — a pre-merge check would have caught it (→ add to checklist)
   - **Test gap** — a category of test was missing (→ add to testing standards)
   - **Informational** — good practice, no action needed

3. **Read current standards files**
   - Read `docs/development-standards.md` — architecture, patterns, naming, testing, error handling
   - Read `docs/pre-flight-checklist.md` — pre-flight steps
   - Read `CLAUDE.md` — project overview and key rules

4. **Draft proposed changes**
   For each non-informational finding, propose a specific edit:
   - Identify the exact section in the target file
   - Write the new/updated text
   - Explain why (link to the PR finding)
   Present ALL proposed changes to the user for approval before editing.

5. **Apply approved changes**
   - Edit the target files with the approved changes
   - Keep existing formatting and style consistent
   - Do NOT remove or weaken existing rules — only add or strengthen

6. **Verify consistency**
   - Check that CLAUDE.md summary rules still match the detailed standards
   - Check that no two rules contradict each other
   - If CLAUDE.md needs updating to reflect new rules, update it

7. **Report**
   - Summarize what was added/changed
   - List any findings that were skipped and why
