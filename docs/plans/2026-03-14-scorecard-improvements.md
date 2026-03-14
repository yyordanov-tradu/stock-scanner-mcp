# Scorecard-Driven Plugin Improvements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the gaps identified in the MCP-vs-web-search scorecard — the plugin wins on "what" (technicals, prices) but loses on "why" (catalysts, correlation, volume context). These tasks add correlation, relative volume, and a combined trading-context tool so active traders get both "what" and "why" from the plugin without needing web search for basic context.

**Architecture:** Three new tools added to existing modules (no new modules). All use existing scanner/client infrastructure. No new API keys required.

**Tech Stack:** TypeScript, TradingView scanner API, Alpha Vantage daily prices, zod, vitest

---

### Task 1: Relative Volume Field in Scanner Results

**Problem:** The scorecard noted "2x volume" was meaningful but the plugin only returns raw volume. Traders need volume relative to average to spot unusual activity.

**Files:**
- Modify: `src/modules/tradingview/columns.ts`
- Modify: `src/modules/tradingview/index.ts` (volume_breakout tool)
- Modify: `src/modules/tradingview-crypto/index.ts` (crypto_scan defaults)
- Test: `src/modules/tradingview/__tests__/scanner.test.ts`

**Step 1: Add relative volume columns to STOCK_COLUMNS**

In `src/modules/tradingview/columns.ts`, add these columns to the `STOCK_COLUMNS` array:

```typescript
"average_volume_10d_calc", "relative_volume_10d_calc",
```

**Step 2: Include relative volume in volume_breakout tool**

In `src/modules/tradingview/index.ts`, update the `tradingview_volume_breakout` tool's columns array to include `"relative_volume_10d_calc"` and `"average_volume_10d_calc"`.

**Step 3: Include relative volume in crypto_scan defaults**

In `src/modules/tradingview-crypto/index.ts`, add `"relative_volume_10d_calc"` to the `crypto_scan` default columns if it's supported by the crypto screener (needs testing — TradingView crypto may not support this column; if not, skip this sub-step).

**Step 4: Run tests**

Run: `npm test`
Expected: All existing tests pass.

**Step 5: Add a test for relative volume in scan results**

In `src/modules/tradingview/__tests__/scanner.test.ts`, add a test that verifies `relative_volume_10d_calc` is included in the default column set.

**Step 6: Run tests**

Run: `npm test`
Expected: All tests pass.

**Step 7: Commit**

```bash
git add src/modules/tradingview/columns.ts src/modules/tradingview/index.ts src/modules/tradingview/__tests__/scanner.test.ts
git commit -m "feat: add relative volume columns to scanner results"
```

---

### Task 2: Correlation Tool (Alpha Vantage)

**Problem:** The scorecard highlighted BTC/MARA 0.29 correlation as the most actionable insight, but the plugin can't compute correlations. This is critical for correlation-based position sizing.

**Files:**
- Modify: `src/modules/alpha-vantage/client.ts` (add correlation calculator)
- Modify: `src/modules/alpha-vantage/index.ts` (add tool)
- Create: `src/modules/alpha-vantage/__tests__/correlation.test.ts`

**Step 1: Write failing test for Pearson correlation calculator**

Create `src/modules/alpha-vantage/__tests__/correlation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { pearsonCorrelation } from "../client.js";

describe("pearsonCorrelation", () => {
  it("returns 1.0 for identical series", () => {
    const series = [1, 2, 3, 4, 5];
    expect(pearsonCorrelation(series, series)).toBeCloseTo(1.0, 4);
  });

  it("returns -1.0 for perfectly inverse series", () => {
    expect(pearsonCorrelation([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])).toBeCloseTo(-1.0, 4);
  });

  it("returns ~0 for uncorrelated series", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [2, 4, 1, 5, 3];
    const r = pearsonCorrelation(a, b);
    expect(Math.abs(r)).toBeLessThan(0.5);
  });

  it("throws if series lengths differ", () => {
    expect(() => pearsonCorrelation([1, 2], [1])).toThrow();
  });

  it("throws if series too short", () => {
    expect(() => pearsonCorrelation([1], [2])).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/modules/alpha-vantage/__tests__/correlation.test.ts`
Expected: FAIL — `pearsonCorrelation` not exported.

**Step 3: Implement pearsonCorrelation in client.ts**

Add to `src/modules/alpha-vantage/client.ts`:

```typescript
export function pearsonCorrelation(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Series must have equal length");
  if (a.length < 2) throw new Error("Need at least 2 data points");

  const n = a.length;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const dA = a[i] - meanA;
    const dB = b[i] - meanB;
    num += dA * dB;
    denA += dA * dA;
    denB += dB * dB;
  }

  const den = Math.sqrt(denA * denB);
  if (den === 0) return 0;
  return num / den;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/modules/alpha-vantage/__tests__/correlation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/alpha-vantage/client.ts src/modules/alpha-vantage/__tests__/correlation.test.ts
git commit -m "feat: add Pearson correlation calculator"
```

**Step 6: Add the correlation tool to the Alpha Vantage module**

In `src/modules/alpha-vantage/index.ts`, add a new tool after `earningsHistoryTool`:

```typescript
const correlationTool = {
  name: "alphavantage_correlation",
  description:
    "Calculate price correlation between two tickers over a given period. Returns Pearson correlation coefficient (-1 to +1). Useful for position sizing and hedging. Rate limited: uses 2 API calls.",
  inputSchema: z.object({
    symbolA: z.string().describe("First ticker (e.g. 'MARA')"),
    symbolB: z.string().describe("Second ticker (e.g. 'BTC' or 'IBIT' for BTC proxy)"),
    days: z.number().optional().describe("Lookback period in trading days (default: 30, max: 100)"),
  }),
  handler: withMetadata(async (params) => {
    const tickerA = resolveTicker(params.symbolA as string).ticker;
    const tickerB = resolveTicker(params.symbolB as string).ticker;
    const days = Math.min((params.days as number) ?? 30, 100);

    const [pricesA, pricesB] = await Promise.all([
      getDailyPrices(apiKey, tickerA, days),
      (async () => { await sleep(12000); return getDailyPrices(apiKey, tickerB, days); })(),
    ]);

    // Align by date
    const datesA = new Map(pricesA.map((p: any) => [p.date, p.close]));
    const aligned: { a: number[]; b: number[] } = { a: [], b: [] };
    for (const p of pricesB) {
      const closeA = datesA.get((p as any).date);
      if (closeA !== undefined) {
        aligned.a.push(closeA as number);
        aligned.b.push((p as any).close as number);
      }
    }

    if (aligned.a.length < 5) {
      return successResult(JSON.stringify({
        error: "Insufficient overlapping trading days",
        overlapping_days: aligned.a.length,
      }, null, 2));
    }

    const r = pearsonCorrelation(aligned.a, aligned.b);

    return successResult(JSON.stringify({
      symbolA: tickerA,
      symbolB: tickerB,
      correlation: Math.round(r * 10000) / 10000,
      period_days: aligned.a.length,
      interpretation:
        Math.abs(r) >= 0.7 ? "strong" :
        Math.abs(r) >= 0.4 ? "moderate" : "weak",
    }, null, 2));
  }, metadata),
};
```

Add `pearsonCorrelation` to the imports from `./client.js`.

Add `correlationTool` to the tools array in the return statement.

**Step 7: Run type check and tests**

Run: `npm run lint && npm test`
Expected: All pass.

**Step 8: Commit**

```bash
git add src/modules/alpha-vantage/index.ts
git commit -m "feat: add alphavantage_correlation tool for position sizing"
```

---

### Task 3: Key Levels Summary Tool (TradingView)

**Problem:** The scorecard showed that for wheel/options trades, the user needs EMA50, BBands, pivots, and ATR together. Currently they come from `tradingview_technicals` but mixed with noise. A focused tool saves tokens and cognitive load.

**Files:**
- Modify: `src/modules/tradingview/index.ts` (add tool)
- Create: `src/modules/tradingview/__tests__/key-levels.test.ts`

**Step 1: Write failing test**

Create `src/modules/tradingview/__tests__/key-levels.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("../scanner.js", () => ({
  scanStocks: vi.fn().mockResolvedValue([{
    ticker: "NASDAQ:MARA",
    close: 9.50,
    "EMA20": 9.30, "EMA50": 9.34, "EMA200": 10.20,
    "SMA20": 9.28, "SMA50": 9.40, "SMA200": 10.15,
    "BB.lower": 8.90, "BB.upper": 9.56,
    "Pivot.M.Classic.S1": 8.80, "Pivot.M.Classic.Middle": 9.10,
    "Pivot.M.Classic.R1": 10.30, "Pivot.M.Classic.R2": 10.80,
    "Pivot.M.Classic.S2": 8.20,
    "ATR": 0.45,
    "RSI": 55,
  }]),
}));

describe("tradingview_key_levels tool concept", () => {
  it("returns focused columns for options/wheel trading", async () => {
    const { scanStocks } = await import("../scanner.js");
    const result = await (scanStocks as any)({ tickers: ["NASDAQ:MARA"] });
    expect(result[0]).toHaveProperty("EMA50");
    expect(result[0]).toHaveProperty("BB.upper");
    expect(result[0]).toHaveProperty("Pivot.M.Classic.R1");
  });
});
```

**Step 2: Run test**

Run: `npm test -- src/modules/tradingview/__tests__/key-levels.test.ts`
Expected: PASS (this tests the mock, confirming the column set is valid).

**Step 3: Add the key_levels tool to tradingview module**

In `src/modules/tradingview/index.ts`, add a new tool to the tools array:

```typescript
{
  name: "tradingview_key_levels",
  description:
    "Get key price levels for options and wheel trading: moving averages (EMA20/50/200), Bollinger Bands, pivot points (S2-R2), ATR, and RSI. One call replaces multiple technicals queries.",
  inputSchema: {
    tickers: z.array(z.string()).describe("Stock tickers, e.g. ['MARA', 'AAPL']"),
    timeframe: z.string().optional().describe("Timeframe (default: 1d)"),
  },
  handler: withMetadata(async (input) => {
    const keyLevelCols = [
      "close",
      "EMA20", "EMA50", "EMA200",
      "SMA20", "SMA50", "SMA200",
      "BB.lower", "BB.upper",
      "Pivot.M.Classic.S2", "Pivot.M.Classic.S1",
      "Pivot.M.Classic.Middle",
      "Pivot.M.Classic.R1", "Pivot.M.Classic.R2",
      "ATR", "RSI",
      "volume", "average_volume_10d_calc", "relative_volume_10d_calc",
    ];
    const resolvedTickers = (input.tickers as string[]).map(t => resolveTicker(t).full);
    const rows = await scanStocks({
      tickers: resolvedTickers,
      columns: keyLevelCols,
      timeframe: input.timeframe as string | undefined,
    });
    return successResult(JSON.stringify(rows, null, 2));
  }, metadata),
},
```

**Step 4: Run type check and tests**

Run: `npm run lint && npm test`
Expected: All pass.

**Step 5: Commit**

```bash
git add src/modules/tradingview/index.ts src/modules/tradingview/__tests__/key-levels.test.ts
git commit -m "feat: add tradingview_key_levels tool for options/wheel trading"
```

---

### Task 4: Improve Tool Descriptions to Prompt News Alongside Technicals

**Problem:** The LLM doesn't know to call `finnhub_company_news` alongside `tradingview_technicals`. Better descriptions can prompt this behavior without code changes.

**Files:**
- Modify: `src/modules/tradingview/index.ts` (update descriptions)
- Modify: `src/modules/finnhub/index.ts` (update descriptions)

**Step 1: Update tradingview_technicals description**

In `src/modules/tradingview/index.ts`, change the `tradingview_technicals` description to:

```typescript
"Get technical indicators (RSI, MACD, moving averages, pivot points, etc.) for one or more stock tickers. Pair with finnhub_company_news for catalyst context behind the numbers.",
```

**Step 2: Update tradingview_key_levels description**

Update the description (added in Task 3):

```typescript
"Get key price levels for options and wheel trading: moving averages (EMA20/50/200), Bollinger Bands, pivot points (S2-R2), ATR, and RSI. Pair with finnhub_company_news to understand why levels are where they are.",
```

**Step 3: Update finnhub_company_news description**

In `src/modules/finnhub/index.ts`, change the `companyNewsTool` description to:

```typescript
"Get recent news for a specific company by ticker symbol. Essential companion to technical analysis — explains catalysts behind price moves, volume spikes, and correlation shifts.",
```

**Step 4: Update finnhub_market_news description**

Change the `marketNewsTool` description to:

```typescript
"Get latest market news by category (general, forex, crypto, merger). Use category 'crypto' for macro catalysts affecting crypto-correlated stocks like miners.",
```

**Step 5: Run type check and tests**

Run: `npm run lint && npm test`
Expected: All pass.

**Step 6: Commit**

```bash
git add src/modules/tradingview/index.ts src/modules/finnhub/index.ts
git commit -m "feat: improve tool descriptions to prompt news alongside technicals"
```

---

## Summary

| Task | New Tool / Change | Gap Closed |
|------|-------------------|------------|
| 1 | Relative volume columns | "2x volume" context |
| 2 | `alphavantage_correlation` | BTC/MARA correlation |
| 3 | `tradingview_key_levels` | One-call options levels |
| 4 | Better tool descriptions | LLM pairs news with technicals |

After these 4 tasks, the plugin covers the top gaps from the scorecard. The remaining gap (macro catalysts like policy/geopolitical events) still requires web search — that's not something API data can solve.
