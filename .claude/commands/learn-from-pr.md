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

4. **Cross-reference with actual codebase**
   Before drafting any rule change, verify it against the real code:
   - Read representative module implementations (e.g., `src/modules/finnhub/client.ts`, newest module) to confirm patterns
   - Check that examples in standards (header names, type names, file names) match real code
   - If a proposed rule would contradict existing merged code, adjust the rule — not the code

5. **Draft proposed changes**
   For each non-informational finding, propose a specific edit:
   - Identify the exact section in the target file
   - Write the new/updated text
   - Explain why (link to the PR finding)

   **Before presenting changes, self-check for these common mistakes:**
   - **Duplication** — does the new rule repeat something already stated elsewhere in the same file? Search for keywords.
   - **Contradiction** — does the new rule conflict with an existing rule? If so, update the existing rule rather than adding a contradictory one.
   - **Wrong specificity** — does the rule use module-specific terms (e.g., `ScanRow[]`, `scanner.test.ts`) where it should be generic? Use general terms unless the rule truly applies to only one module.
   - **Stale references** — does the rule reference file names, header names, or type names that don't exist in the codebase? Verify against actual code.
   - **CLAUDE.md consistency** — if a rule is added/changed in `development-standards.md`, does the corresponding summary in `CLAUDE.md` need updating? Always check. Also check if module counts, version numbers, env vars, or project structure in `CLAUDE.md` are affected.
   - **Hard vs. soft rules** — use MUST only for true invariants. If exceptions exist (even one merged module), use SHOULD with a documented deviation process.

   Present ALL proposed changes to the user for approval before editing.

6. **Apply approved changes**
   - Edit the target files with the approved changes
   - Keep existing formatting and style consistent
   - Do NOT remove or weaken existing rules — only add or strengthen

7. **Verify consistency (post-edit)**
   - Re-read edited files and confirm no duplication or contradiction was introduced
   - Check that CLAUDE.md summary rules still match the detailed standards
   - Check that CLAUDE.md project metadata (version, module count, tool count, env vars, structure) is current
   - If CLAUDE.md needs updating to reflect new rules or changed project state, update it

8. **Report**
   - Summarize what was added/changed
   - List any findings that were skipped and why
