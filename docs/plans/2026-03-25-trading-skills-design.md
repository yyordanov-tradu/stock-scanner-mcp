# Trading Skills Design Document

**Date:** 2026-03-25
**Status:** Implemented (PR #144)
**Author:** Yordan Yordanov + Claude Code

## Overview

16 Claude Code skills that orchestrate stock-scanner-mcp's 49 MCP tools into ready-made trading workflows. Skills are installable slash commands — users type `/morning-briefing` and get a structured market analysis.

## Goals

1. Make the plugin's 49 tools accessible without memorizing tool names or parameters
2. Provide professional-grade analysis workflows used by institutional desks
3. Showcase the plugin's capabilities to attract new users
4. Work for intermediate traders — action-oriented, no hand-holding

## Architecture

### File Structure

```
skills/
├── TOOLS.md                         # Tool reference (49 tools)
├── daily/
│   ├── morning-briefing/SKILL.md    # Pre-market scan
│   ├── market-close-recap/SKILL.md  # EOD summary
│   └── crypto-briefing/SKILL.md     # Crypto overview
├── analysis/
│   ├── analyze-stock/SKILL.md       # Full equity deep dive
│   ├── compare/SKILL.md             # Side-by-side (2-5 stocks)
│   └── analyze-crypto/SKILL.md      # Full crypto analysis
├── strategies/
│   ├── swing-setup/SKILL.md         # Swing trade scanner
│   ├── earnings-play/SKILL.md       # Pre-earnings options
│   ├── options-flow/SKILL.md        # Smart money flow
│   └── dividend-screen/SKILL.md     # Income investing
├── macro/
│   ├── macro-dashboard/SKILL.md     # Economic indicators
│   ├── fed-watch/SKILL.md           # Fed rate analysis
│   └── sector-rotation/SKILL.md     # Sector rotation signals
└── risk/
    ├── insider-tracker/SKILL.md     # Insider activity
    ├── smart-money/SKILL.md         # Institutional flow
    └── risk-check/SKILL.md          # Pre-trade risk scorecard
```

### Skill Format

Each skill is a standard Claude Code SKILL.md with YAML frontmatter:

```yaml
---
name: skill-id
description: Single sentence, action-oriented, under 200 chars
argument-hint: [TICKER]  # if applicable
---
```

Body follows a consistent structure:
1. **Overview** — 2-3 sentence intro + announcement line
2. **Input** — argument parsing with fail-fast validation (if applicable)
3. **Data Collection** — wave-based parallel tool execution tables
4. **Analysis** — cross-reference instructions (never per-tool summaries)
5. **Output Format** — exact sections, tables, structured verdict
6. **Limitations** — data delay disclaimers
7. **Common Mistakes** — anti-patterns to avoid

### Design Decisions

**Parallel wave execution.** Tools grouped by dependency into waves. Wave 1 fires all independent calls in parallel. Wave 2 runs after Wave 1 when it needs results (e.g., options expiration dates). Explicit "call ALL in parallel" language triggers Claude's parallel tool invocation.

**REQUIRED vs ENRICHMENT.** Each tool is marked REQUIRED (skill cannot function without it) or ENRICHMENT (nice-to-have, skip silently if unavailable). Alpha Vantage and FRED tools are ENRICHMENT in most skills since they need optional API keys. Exception: macro-dashboard and fed-watch mark FRED as REQUIRED with a prerequisite note.

**Cross-reference analysis.** Skills instruct Claude to synthesize data across tools, not summarize each independently. E.g., "Do indices and Fear & Greed agree on risk appetite?" forces multi-source reasoning.

**"DO NOT reproduce raw tool output."** Every skill includes this directive. Without it, Claude dumps JSON arrays verbatim, consuming 80% of output on raw data.

**Flag accumulation for risk scoring.** Complex conditional logic uses independent flag checks with arithmetic scoring (0-8 flags) instead of nested if/else, which Claude handles unreliably.

**Anchored verdicts.** Every skill ends with a structured verdict using fixed vocabulary (BULLISH/BEARISH/NEUTRAL, HIGH/MEDIUM/LOW confidence, specific price levels).

## Installation

### Current (manual)

```bash
# Clone the repo
git clone https://github.com/yyordanov-tradu/stock-scanner-mcp.git

# Copy skills to user scope (works in all projects)
cp -r stock-scanner-mcp/skills/*/ ~/.claude/skills/

# Or copy to project scope (works only in this directory)
cp -r stock-scanner-mcp/skills/*/ .claude/skills/
```

### Planned (automated)

```bash
npx stock-scanner-mcp install-skills
# Interactive: user scope or project scope?
# Interactive: which skills? (all / pick categories)
# Copies selected SKILL.md files to the right location
```

Implementation: add `install-skills` subcommand to the existing CLI entry point. Detect first arg, run installer instead of MCP server. Skills bundled in npm package via `files` field in package.json.

## Tool Coverage

| Skill | Tools Used | Waves |
|-------|-----------|-------|
| morning-briefing | 10 | 1 |
| market-close-recap | 10 | 1 |
| crypto-briefing | 6 | 1 |
| analyze-stock | 11 | 1 |
| compare | 3-7 | 1 |
| analyze-crypto | 5 | 1 |
| swing-setup | 8-14 | 2 |
| earnings-play | 11 | 2 |
| options-flow | 8 | 2 |
| dividend-screen | 3-8 | 1 |
| macro-dashboard | 11 | 1 |
| fed-watch | 11 | 1 |
| sector-rotation | 4-10 | 2 |
| insider-tracker | 5 | 1 |
| smart-money | 6 | 1 |
| risk-check | 9 | 1 |

## Review Process

Skills were created by 5 parallel prompt engineering agents (one per category) and reviewed by 3 independent experts:

1. **Prompt engineer** — parallel execution, synthesis quality, token efficiency, graceful degradation, actionability. Found 6 critical issues (API-key tools as REQUIRED), 9 significant issues.
2. **Format compliance expert** — YAML frontmatter, heading depth, voice consistency, tool name format. Found 4 H4 heading violations, 7 voice inconsistencies.
3. **Quant analyst** — trading accuracy, threshold correctness, data limitations, missing analysis. Found 4 skills misusing market-wide put/call ratio, inconsistent RSI thresholds, missing data delay disclaimers.

All critical and major issues were fixed before commit.

## Future Work

- `npx stock-scanner-mcp install-skills` CLI installer
- Skills README with catalog and usage examples
- Additional skills: watchlist tracker, portfolio risk, correlation scanner
- Skill versioning and update mechanism
