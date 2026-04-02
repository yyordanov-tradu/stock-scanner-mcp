# Latency & Reliability Snapshot

Date: 2026-04-02

This table provides a practical credibility snapshot for engineering and user trust discussions.

## Test reliability (CI-local snapshot)

| Check | Result | Notes |
|---|---|---|
| `npm test --silent` | 28/28 files pass, 343/343 tests pass | Fast feedback on module behavior, parsing, and integration boundaries |
| `npm run lint --silent` | pass | Type-level consistency guardrail |

## Scenario benchmark latency/reliability

Source: `docs/benchmarks/v2-2026-03-15.md`

| Scenario | Tool Calls | Pass Rate | Runtime | Main failure modes |
|---|---:|---:|---:|---|
| NVDA options decision support | 24 | 20/24 (83.3%) | ~31s | Alpha Vantage free-tier rate limits, premium-gated endpoints, one benchmark script naming mismatch |

## What this means in practice

- **Reliability:** Core modules are stable enough for routine analysis workflows.
- **Latency:** Multi-tool runs complete in tens of seconds rather than minutes.
- **Transparency:** Known external API constraints are documented and attributable.

## Improvement targets

1. Add per-module p50/p95 latency from automated benchmark runs.
2. Track rolling 7-day tool success rate by module.
3. Publish a changelog section showing reliability trendline deltas after each release.
