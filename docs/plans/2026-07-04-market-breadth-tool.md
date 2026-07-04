# Market Breadth Tool Implementation Plan

**Date:** 2026-07-04
**Status:** Draft for review
**Author:** Codex
**GitHub issue:** #92

## Decision Summary

Implement issue #92 as a new keyless MCP module named `market-breadth` with one read-only tool:

- `market_breadth`

The tool should aggregate raw US equity breadth metrics from the existing TradingView scanner integration:

- advance/decline counts and ratio
- percent of stocks above 50-day SMA
- percent of stocks above 200-day SMA
- 52-week new highs and new lows

This should be a separate module rather than another TradingView tool because the result is not a stock screen. It is a market-level aggregate derived from scanner data.

## Current State

The issue is not implemented on local `main` or fetched `origin/main`.

Evidence:

- no `src/modules/market-breadth/` directory exists
- no `market_breadth` tool exists in `src`, `dist`, `README.md`, or `CLAUDE.md`
- `src/registry.ts` has no market breadth import or catalog entry
- TradingView currently exposes 10 stock tools, none of which aggregate breadth
- `sentiment_fear_greed` includes CNN's stock price breadth score, but it is a composite sentiment indicator rather than raw breadth counts

## Product Scope

### In Scope

- Add one MCP module: `market-breadth`
- Add one tool: `market_breadth`
- Use the existing TradingView scanner endpoint, with no new API key
- Support a configurable universe:
  - `both` default: NYSE + NASDAQ
  - `NYSE`
  - `NASDAQ`
  - `AMEX`
- Return raw counts, percentages, denominators, and metadata
- Add unit tests for aggregation, null handling, cache behavior, and module registration
- Update README and CLAUDE.md module/tool counts

### Out of Scope

- Heatmaps or sector-level breadth breakdowns
- Intraday breadth history
- Index-specific membership breadth such as S&P 500-only breadth
- External breadth APIs
- UI or sidecar views
- Alerts or scheduled snapshots

## Proposed Tool Contract

### Tool Name

`market_breadth`

### Module Name

`market-breadth`

### Input Schema

```typescript
z.object({
  universe: z.enum(["both", "NYSE", "NASDAQ", "AMEX"]).optional(),
  limit: z.number().int().min(100).max(10000).optional(),
  newHighLowThresholdPct: z.number().min(0).max(5).optional(),
})
```

Defaults:

- `universe`: `both`
- `limit`: `3000` per scanner request
- `newHighLowThresholdPct`: `0.5`

The threshold means a stock counts as a new high when `close >= High.52week * 0.995`, and a new low when `close <= Low.52week * 1.005`.

### Output Shape

```json
{
  "universe": "both",
  "exchanges": ["NYSE", "NASDAQ"],
  "sampleSize": 3000,
  "advanceDecline": {
    "advancers": 1234,
    "decliners": 1456,
    "unchanged": 310,
    "ratio": 0.85,
    "advancePercent": 41.13,
    "declinePercent": 48.53
  },
  "movingAverages": {
    "aboveSma50": 1420,
    "sma50Denominator": 2840,
    "aboveSma50Percent": 50.0,
    "aboveSma200": 1320,
    "sma200Denominator": 2710,
    "aboveSma200Percent": 48.71
  },
  "newHighsLows": {
    "newHighs": 120,
    "newLows": 180,
    "thresholdPct": 0.5,
    "denominator": 2760
  },
  "metadata": {
    "source": "tradingview",
    "dataDelay": "15min",
    "asOf": "2026-07-04T00:00:00.000Z"
  }
}
```

The exact numbers above are illustrative.

## Technical Design

### Files to Add

```text
src/modules/market-breadth/
├── client.ts
├── index.ts
└── __tests__/
    └── client.test.ts
```

### Files to Modify

```text
src/registry.ts
README.md
CLAUDE.md
```

If generated artifacts are expected for release or validation, also update:

```text
docs/sidecar-openapi.json
```

using the existing generation command rather than hand editing.

### Client Design

Create pure aggregation logic in `client.ts` so it can be tested without tool-handler plumbing.

Suggested exports:

```typescript
export type MarketBreadthUniverse = "both" | "NYSE" | "NASDAQ" | "AMEX";

export interface MarketBreadthOptions {
  universe?: MarketBreadthUniverse;
  limit?: number;
  newHighLowThresholdPct?: number;
}

export async function getMarketBreadth(options?: MarketBreadthOptions): Promise<MarketBreadthResult>;
export function aggregateMarketBreadth(rows: ScanRow[], options: Required<MarketBreadthOptions>): MarketBreadthResult;
```

Columns requested from TradingView:

```typescript
[
  "close",
  "change",
  "SMA50",
  "SMA200",
  "High.52week",
  "Low.52week",
  "name",
  "exchange"
]
```

Use `scanStocks` from `src/modules/tradingview/scanner.ts` rather than duplicating HTTP logic.

### Universe Handling

TradingView scanner currently accepts one `exchange` per request. For `both`, call:

- `scanStocks({ exchange: "NYSE", ... })`
- `scanStocks({ exchange: "NASDAQ", ... })`

Then merge rows before aggregation.

For single-exchange universes, make one scanner call.

### Aggregation Rules

Advance/decline:

- `change > 0` counts as advancing
- `change < 0` counts as declining
- `change === 0` counts as unchanged
- `null` or non-number change is excluded from this denominator
- ratio is `advancers / decliners`, with `null` when decliners is zero

Moving averages:

- count above SMA50 when both `close` and `SMA50` are numbers and `close > SMA50`
- count above SMA200 when both `close` and `SMA200` are numbers and `close > SMA200`
- each SMA metric has its own denominator

New highs/lows:

- use only rows with numeric `close`, `High.52week`, and `Low.52week`
- count new high when `close >= High.52week * (1 - thresholdPct / 100)`
- count new low when `close <= Low.52week * (1 + thresholdPct / 100)`
- expose the threshold in the response

Rounding:

- percentages rounded to 2 decimals
- ratios rounded to 2 decimals
- counts stay integers

### Caching

Use `TtlCache` from `src/shared/cache.ts`.

Recommended TTL: 15 minutes.

Reasoning:

- the TradingView stock scanner data is delayed and changes during market hours
- 15 minutes aligns with current TradingView module metadata better than a 1-hour cache
- repeated prompts avoid duplicate large scanner calls

Cache key should include:

- universe
- limit
- threshold

## Module Registration

Add to `src/registry.ts`:

```typescript
import { createMarketBreadthModule } from "./modules/market-breadth/index.js";
```

Add catalog entry:

```typescript
{ name: "market-breadth", envVar: null, toolCount: 1, factory: () => createMarketBreadthModule() }
```

Keep the module key kebab-case to match existing module directory naming, and keep the tool name snake_case with the module prefix.

## Testing Plan

### Unit Tests

Add `src/modules/market-breadth/__tests__/client.test.ts` covering:

- module factory returns one tool named `market_breadth`
- aggregation counts advancers, decliners, and unchanged correctly
- ratio is `null` when decliners are zero
- SMA denominators exclude null values independently
- new high/new low threshold works at the boundary
- `both` universe makes two scanner calls and merges rows
- single-exchange universe makes one scanner call
- tool handler returns valid formatted JSON

### Existing Tests to Update

Update registry or module-count tests if any fail after adding the catalog entry.

### Quality Gates

Run:

```bash
npx vitest run src/modules/market-breadth/__tests__/client.test.ts
npm test
npm run build
npm run validate-tools
```

If sidecar OpenAPI output changes:

```bash
npm run generate-openapi
```

Then verify:

```bash
npm run validate-structure
```

## Documentation Updates

### README.md

Update:

- module summary list
- module/tool table
- tool list section
- repository structure diagram if module counts are shown

Add a short section:

```markdown
### Market Breadth — Raw Market Structure (no API key)

| Tool | Description |
|---|---|
| `market_breadth` | Advance/decline ratio, % above 50/200 SMA, and 52-week new highs/lows for US equities |
```

### CLAUDE.md

Update:

- module count
- tool count
- module directory list
- any quick-reference table that enumerates modules

## Risks and Mitigations

### Risk: TradingView Column Availability

`High.52week` and `Low.52week` are not currently listed in `STOCK_COLUMNS`, though `scanStocks` can request arbitrary column names.

Mitigation:

- add tests asserting requested column names pass through unchanged
- if live validation shows unsupported columns, fall back to available TradingView 52-week fields or defer high/low counts with a clear error

### Risk: Scanner Limit Does Not Cover Full Universe

A limit of 3000 may not cover every NYSE + NASDAQ listing.

Mitigation:

- expose `limit` with a max of 10000
- report `sampleSize`
- use separate calls for NYSE and NASDAQ under `both`

### Risk: ETFs and Illiquid Symbols Skew Counts

The scanner universe may include ETFs, ADRs, funds, or low-liquidity listings.

Mitigation:

- V1 accepts TradingView's exchange universe as-is
- future issue can add optional filters for common stock only, market cap, or volume

### Risk: Market-Hours Interpretation

Breadth changes during the session and can differ from official end-of-day breadth data.

Mitigation:

- metadata should say `source: tradingview` and `dataDelay: 15min`
- README should describe this as TradingView scanner-derived breadth, not official exchange breadth

## Implementation Steps

1. Add `src/modules/market-breadth/client.ts` with types, cache, scanner calls, and pure aggregation.
2. Add `src/modules/market-breadth/index.ts` with the `market_breadth` MCP tool.
3. Add focused unit tests for aggregation and tool behavior.
4. Register the module in `src/registry.ts`.
5. Update README and CLAUDE.md counts and tool docs.
6. Run targeted tests, full tests, build, and tool validation.
7. Generate OpenAPI docs if validation indicates generated metadata changed.
8. Prepare final summary and note that issue #92 can be closed only after tests and generated artifacts pass.

## Review Questions

Please review and approve or adjust these decisions before implementation:

- Should the module be separate as `market-breadth`, or should this be added to the existing `tradingview` module?
- Is `both` = NYSE + NASDAQ sufficient for the default universe, or should AMEX be included by default?
- Is a 15-minute cache TTL acceptable, or do you prefer 1 hour as suggested in the GitHub issue analysis?
- Should V1 filter out ETFs/ADRs/low-volume names, or keep the raw TradingView exchange universe?
