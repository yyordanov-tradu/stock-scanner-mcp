# GitHub Baseline Review — stock-scanner-mcp

Date: 2026-04-02

## Scope and baseline

This review rates `yyordanov-tradu/stock-scanner-mcp` against similar finance-focused MCP servers on GitHub as of 2026-04-02.

Compared repositories:
- https://github.com/yyordanov-tradu/stock-scanner-mcp
- https://github.com/catherinedparnell/mcp-finnhub
- https://github.com/sverze/stock-market-mcp-server
- https://github.com/SalZaki/finnhub-mcp
- https://github.com/maybe-finance/synth-mcp

## Quick project profile (this repo)

- 61 tools across 12 modules with both stock and crypto coverage.
- Claims 36 zero-key tools and 17 optional bundled skills.
- Includes tests and strong local quality checks; current suite reports 343 passing tests across 28 files.
- Current public traction is still early (0 stars, 0 forks), despite materially higher scope than peers.

## Baseline snapshot (GitHub signal)

| Repo | Stars | Forks | Commits | Notes |
|---|---:|---:|---:|---|
| yyordanov-tradu/stock-scanner-mcp | 0 | 0 | 180 | Highest functional scope in this comparison |
| catherinedparnell/mcp-finnhub | 7 | 9 | 3 | Very early code history but some visibility |
| sverze/stock-market-mcp-server | 5 | 2 | 2 | Minimal implementation |
| SalZaki/finnhub-mcp | 3 | 0 | 201 | Strong engineering framing, narrower product |
| maybe-finance/synth-mcp | 2 | 4 | 15 | Broader finance API wrapper, hosted-API model |

Interpretation: this project currently over-indexes on product depth relative to its social proof. It appears under-discovered, not under-built.

## Rating rubric (0–10)

Weights:
- Feature breadth and practical utility: 30%
- Engineering quality and reliability: 25%
- Developer experience and documentation: 20%
- Market differentiation in MCP finance niche: 15%
- Adoption/traction signal (stars/forks/community): 10%

### Scores

| Dimension | Score | Rationale |
|---|---:|---|
| Feature breadth and utility | 9.2 | Multi-asset coverage, options analytics, SEC/insider, macro and forex in one MCP package |
| Engineering quality and reliability | 8.8 | Large automated test suite; modular code organization |
| Developer experience and docs | 8.7 | Good README, install paths, module table, skills catalog |
| Differentiation | 8.9 | Unusually complete no-key + key-unlocked hybrid architecture |
| Adoption/traction | 3.2 | Low GitHub visibility compared with smaller peers |

**Weighted final score: 8.1 / 10**

## Relative position vs similar projects

- **Functionality:** Top-tier in this peer set (likely top decile among finance MCP repos by tool count and domain coverage).
- **Code maturity:** High for category; commit and test footprint indicates sustained iteration.
- **Visibility:** Bottom-tier currently; repository growth mechanics (discoverability, social proof, distribution) lag implementation quality.

## Strengths

1. Broad, composable tool surface area with clear module boundaries.
2. Meaningful default experience without API keys.
3. Built-in workflow skills that convert low-level tools into higher-value outcomes.
4. Sidecar HTTP mode increases integration options beyond MCP clients.

## Gaps holding the score back

1. Traction signals are weaker than scope suggests (stars/forks, ecosystem mentions).
2. README has minor consistency drift (e.g., tool/module counts in older docs vs newer claims).
3. Benchmark narratives are strong but still read more like internal validation than public benchmark artifacts.

## Priority recommendations

1. **Distribution pass (highest ROI):**
   - Submit to MCP server registries/directories and pin “getting started” short video/GIF.
   - Publish monthly changelog snippets to X/Reddit/Discord MCP communities.
2. **Proof pass:**
   - Add a concise public comparison table against 3 common alternatives in README.
   - Add lightweight adoption telemetry proxies (weekly npm downloads trend badges in release notes).
3. **Consistency pass:**
   - Normalize all docs to current tool/module counts and remove stale architecture numbers.
4. **Trust pass:**
   - Add a short “data source SLA/limitations” section per module (delay, rate limits, free-tier caveats).

## Final verdict

If the baseline is “similar GitHub finance MCP servers,” this project ranks as a **high-quality, feature-leading codebase with below-expected discoverability**.

- **Overall rating: 8.1/10**
- **Product quality alone (excluding traction): ~9.0/10**
- **Current GitHub market position: early-stage / underrated**
