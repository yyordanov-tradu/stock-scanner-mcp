# Fix Yahoo Options PR #71 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Fix all P1/P2 review findings in PR #71, add back `options-cboe` module, add `options_unusual_activity` tool, and write comprehensive tests.

**Architecture:** The `feat/yahoo-options` branch replaces Tradier with Yahoo Finance for options data. This plan fixes security issues, adds missing features, and restores test coverage. Three modules total: `options` (Yahoo, 4 tools, no key), `options-cboe` (CBOE CSV, 1 tool, no key).

**Tech Stack:** TypeScript, zod, vitest, shared infra (`httpGet`, `TtlCache`, `withMetadata`, `successResult`, `resolveTicker`).

**Branch:** `feat/yahoo-options` (PR #71)

---

## Parallel Execution Guide

| Work Stream | Tasks | Dependencies |
|-------------|-------|-------------|
| **A: Fix options module** | Task 1, 2, 3 | Sequential (each builds on prior) |
| **B: Restore options-cboe** | Task 4 | Independent of A |
| **C: Add unusual activity** | Task 5 | Requires Task 1 (client fixes) |
| **D: Integration** | Task 6 | Requires A + B + C complete |

Streams A and B can run in parallel. C depends on A. D runs last.

---

## Reference: Key Codebase Patterns

- `src/shared/resolver.ts` — `resolveTicker()` — normalizes symbol input, strips exchange prefix
- `src/shared/http.ts` — `httpGet()` with 10s timeout, `sanitizeUrl()`, `DEFAULT_HEADERS`
- `src/shared/utils.ts` — `withMetadata()` — wraps handlers, catches errors, injects `_meta`
- `src/shared/types.ts` — `ModuleDefinition`, `ToolDefinition`, `successResult()`
- `src/shared/cache.ts` — `TtlCache` with `getOrFetch()`
- `src/modules/finnhub/__tests__/client.test.ts` — test pattern (vi.stubGlobal fetch)

---

## Task 1: Fix client.ts — Security & Correctness (Stream A)

**Files:**
- Modify: `src/modules/options/client.ts`

### Step 1: Fix URL encoding and add resolveTicker

Replace the current `fetchOptionChain` function. Key changes:
- Add `encodeURIComponent` on symbol in URL path
- Add `resolveTicker` for symbol normalization
- Type the cache as `TtlCache<OptionChain>` instead of `TtlCache<any>`
- Type the Yahoo response interface instead of `any`
- Add null guards on `result.quote` and `result.options[0]`
- Add guard for `S <= 0` or `K <= 0` in processOptions (prevents NaN in Greeks)
- Remove custom User-Agent (use shared default)
- Accept `riskFreeRate` parameter (default 0.045)

```typescript
import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";
import { resolveTicker } from "../../shared/resolver.js";
import { calculateGreeks, calculateMaxPain } from "./greeks.js";

const BASE_URL = "https://query1.finance.yahoo.com/v7/finance/options";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new TtlCache<OptionChain>(CACHE_TTL);
const DEFAULT_RISK_FREE_RATE = 0.045;

export interface OptionContract {
  symbol: string;
  strike: number;
  lastPrice: number;
  bid: number;
  ask: number;
  change: number;
  percentChange: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
}

export interface OptionChain {
  underlyingSymbol: string;
  underlyingPrice: number;
  expirationDates: number[];
  strikes: number[];
  calls: OptionContract[];
  puts: OptionContract[];
  maxPain: number;
}

interface YahooOptionRaw {
  contractSymbol?: string;
  strike?: number;
  lastPrice?: number;
  bid?: number;
  ask?: number;
  change?: number;
  percentChange?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
  inTheMoney?: boolean;
}

interface YahooOptionsResponse {
  optionChain?: {
    result?: Array<{
      underlyingSymbol?: string;
      expirationDates?: number[];
      strikes?: number[];
      quote?: { regularMarketPrice?: number };
      options?: Array<{
        expirationDate?: number;
        calls?: YahooOptionRaw[];
        puts?: YahooOptionRaw[];
      }>;
    }>;
  };
}

function mapOption(
  raw: YahooOptionRaw,
  isCall: boolean,
  underlyingPrice: number,
  yearsToExpiration: number,
  riskFreeRate: number,
): OptionContract {
  const strike = raw.strike ?? 0;
  const iv = raw.impliedVolatility ?? 0;

  let greeks: { delta: number; gamma: number; theta: number; vega: number } | null = null;
  if (underlyingPrice > 0 && strike > 0 && iv > 0 && yearsToExpiration > 0) {
    greeks = calculateGreeks(underlyingPrice, strike, yearsToExpiration, riskFreeRate, iv, isCall);
  }

  return {
    symbol: raw.contractSymbol ?? "",
    strike,
    lastPrice: raw.lastPrice ?? 0,
    bid: raw.bid ?? 0,
    ask: raw.ask ?? 0,
    change: raw.change ?? 0,
    percentChange: raw.percentChange ?? 0,
    volume: raw.volume ?? 0,
    openInterest: raw.openInterest ?? 0,
    impliedVolatility: iv,
    inTheMoney: raw.inTheMoney ?? false,
    delta: greeks?.delta ?? null,
    gamma: greeks?.gamma ?? null,
    theta: greeks?.theta ?? null,
    vega: greeks?.vega ?? null,
  };
}

export async function fetchOptionChain(
  rawSymbol: string,
  expiration?: number,
  riskFreeRate = DEFAULT_RISK_FREE_RATE,
): Promise<OptionChain> {
  const { ticker } = resolveTicker(rawSymbol);
  const cacheKey = `options:${ticker}:${expiration ?? "latest"}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let url = `${BASE_URL}/${encodeURIComponent(ticker)}`;
  if (expiration) {
    url += `?date=${expiration}`;
  }

  const response = await httpGet<YahooOptionsResponse>(url);

  const result = response?.optionChain?.result?.[0];
  if (!result) {
    throw new Error(`No options data found for symbol: ${ticker}`);
  }

  const underlyingPrice = result.quote?.regularMarketPrice;
  if (!underlyingPrice) {
    throw new Error(`No price data available for symbol: ${ticker}`);
  }

  const chainData = result.options?.[0];
  if (!chainData) {
    throw new Error(`No option contracts found for symbol: ${ticker}`);
  }

  const expirationTimestamp = chainData.expirationDate ?? 0;
  const now = Date.now() / 1000;
  const yearsToExpiration = Math.max((expirationTimestamp - now) / (365 * 24 * 60 * 60), 0);

  const calls = (chainData.calls ?? []).map(opt => mapOption(opt, true, underlyingPrice, yearsToExpiration, riskFreeRate));
  const puts = (chainData.puts ?? []).map(opt => mapOption(opt, false, underlyingPrice, yearsToExpiration, riskFreeRate));
  const strikes = result.strikes ?? [];

  const processedChain: OptionChain = {
    underlyingSymbol: result.underlyingSymbol ?? ticker,
    underlyingPrice,
    expirationDates: result.expirationDates ?? [],
    strikes,
    calls,
    puts,
    maxPain: calculateMaxPain(strikes, calls, puts),
  };

  cache.set(cacheKey, processedChain);
  return processedChain;
}
```

### Step 2: Run build to verify no TypeScript errors

```bash
npm run build
```

Expected: Build succeeds.

### Step 3: Commit

```bash
git add src/modules/options/client.ts
git commit -m "fix: harden Yahoo options client — URL encoding, resolveTicker, typed response, null guards"
```

---

## Task 2: Fix greeks.ts — Edge Cases & Types (Stream A)

**Files:**
- Modify: `src/modules/options/greeks.ts`

### Step 1: Add S/K guard and typed max pain interface

Key changes:
- Add `S <= 0` and `K <= 0` guard to `calculateGreeks`
- Define `OptionForPain` interface instead of `any[]` for `calculateMaxPain`
- Add JSDoc for vega `/100` convention
- Handle empty `strikes` array

```typescript
/**
 * Black-Scholes Greeks Implementation
 */

// Normal CDF — Abramowitz & Stegun approximation (26.2.17), max error 7.5e-8
function cnd(x: number): number {
  const a1 = 0.31938153;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const L = Math.abs(x);
  const K = 1.0 / (1.0 + 0.2316419 * L);
  let w = 1.0 - (1.0 / Math.sqrt(2.0 * Math.PI)) * Math.exp(-L * L / 2.0) *
    (a1 * K + a2 * K * K + a3 * Math.pow(K, 3) + a4 * Math.pow(K, 4) + a5 * Math.pow(K, 5));
  if (x < 0) w = 1.0 - w;
  return w;
}

function pdf(x: number): number {
  return Math.exp(-x * x / 2.0) / Math.sqrt(2.0 * Math.PI);
}

export interface Greeks {
  delta: number;
  gamma: number;
  /** Daily theta — dollar change per calendar day */
  theta: number;
  /** Vega per 1 percentage-point IV move (market convention, raw B-S / 100) */
  vega: number;
}

/**
 * Calculates Greeks using Black-Scholes.
 * Returns { delta: 0, gamma: 0, theta: 0, vega: 0 } for invalid inputs.
 */
export function calculateGreeks(
  S: number,
  K: number,
  T: number,
  r: number,
  v: number,
  isCall: boolean,
): Greeks {
  if (T <= 0 || v <= 0 || S <= 0 || K <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0 };
  }

  const d1 = (Math.log(S / K) + (r + (v * v) / 2.0) * T) / (v * Math.sqrt(T));
  const d2 = d1 - v * Math.sqrt(T);

  let delta: number;
  let theta: number;

  if (isCall) {
    delta = cnd(d1);
    theta = (-S * pdf(d1) * v / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * cnd(d2)) / 365;
  } else {
    delta = cnd(d1) - 1;
    theta = (-S * pdf(d1) * v / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * cnd(-d2)) / 365;
  }

  const gamma = pdf(d1) / (S * v * Math.sqrt(T));
  const vega = (S * Math.sqrt(T) * pdf(d1)) / 100;

  return {
    delta: parseFloat(delta.toFixed(6)),
    gamma: parseFloat(gamma.toFixed(6)),
    theta: parseFloat(theta.toFixed(6)),
    vega: parseFloat(vega.toFixed(6)),
  };
}

export interface OptionForPain {
  strike: number;
  openInterest: number;
}

/**
 * Calculates max pain — the strike where total option holder payout is minimized.
 */
export function calculateMaxPain(
  strikes: number[],
  calls: OptionForPain[],
  puts: OptionForPain[],
): number {
  if (strikes.length === 0) return 0;

  let minPain = Infinity;
  let maxPainStrike = strikes[0];

  for (const candidate of strikes) {
    let pain = 0;
    for (const call of calls) {
      if (candidate > call.strike) {
        pain += (candidate - call.strike) * (call.openInterest ?? 0);
      }
    }
    for (const put of puts) {
      if (candidate < put.strike) {
        pain += (put.strike - candidate) * (put.openInterest ?? 0);
      }
    }
    if (pain < minPain) {
      minPain = pain;
      maxPainStrike = candidate;
    }
  }

  return maxPainStrike;
}
```

### Step 2: Run build

```bash
npm run build
```

### Step 3: Commit

```bash
git add src/modules/options/greeks.ts
git commit -m "fix: harden Greeks — guard S/K<=0, type max pain params, document vega convention"
```

---

## Task 3: Fix index.ts — Input Validation, Metadata, Limit, Unusual Activity (Stream A)

**Files:**
- Modify: `src/modules/options/index.ts`

### Step 1: Rewrite index.ts with all fixes

Key changes:
- Add `resolveTicker` import and usage in all handlers
- Add symbol validation schema (`min(1).max(10)`)
- Accept YYYY-MM-DD expiration strings (convert to Unix internally)
- Fix metadata: `"15min"` not `"real-time"`
- Remove unused `errorResult` import
- Add `limit` parameter on `options_chain` (default 50, max 200)
- Add `options_unusual_activity` tool (4th tool)

```typescript
import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import { fetchOptionChain } from "./client.js";
import { withMetadata } from "../../shared/utils.js";

const metadata = { source: "yahoo-finance", dataDelay: "15min" };

const symbolSchema = z.string().min(1).max(10)
  .describe("Stock ticker symbol (e.g. 'AAPL', 'NYSE:GM')");

function parseExpiration(value: string | undefined): number | undefined {
  if (!value) return undefined;
  // Accept YYYY-MM-DD → convert to Unix timestamp
  const ts = Math.floor(new Date(value + "T00:00:00Z").getTime() / 1000);
  if (isNaN(ts)) return undefined;
  return ts;
}

const expirationsTool: ToolDefinition = {
  name: "options_expirations",
  description:
    "Get all available option expiration dates for a stock ticker. " +
    "Call this first to discover valid dates, then pass one to options_chain or options_max_pain.",
  inputSchema: z.object({
    symbol: symbolSchema,
  }),
  handler: withMetadata(async (params) => {
    const chain = await fetchOptionChain(params.symbol as string);
    const dates = chain.expirationDates.map(
      d => new Date(d * 1000).toISOString().split("T")[0],
    );
    return successResult(JSON.stringify({
      symbol: chain.underlyingSymbol,
      underlyingPrice: chain.underlyingPrice,
      expirations: dates,
    }, null, 2));
  }, metadata),
};

const chainTool: ToolDefinition = {
  name: "options_chain",
  description:
    "Get the full option chain (calls and puts) with calculated Greeks (Delta, Gamma, Theta, Vega). " +
    "Use options_expirations first to find valid dates. If expiration is omitted, uses nearest date. " +
    "Response can be large — use 'limit' to cap contracts per side.",
  inputSchema: z.object({
    symbol: symbolSchema,
    expiration: z.string().optional()
      .describe("Expiration date as YYYY-MM-DD (e.g. '2026-04-17'). If omitted, uses nearest."),
    side: z.enum(["call", "put", "both"]).optional()
      .describe("Filter by option type (default: both)"),
    limit: z.number().optional()
      .describe("Max contracts per side (default: 50, max: 200)"),
  }),
  handler: withMetadata(async (params) => {
    const expUnix = parseExpiration(params.expiration as string | undefined);
    const chain = await fetchOptionChain(params.symbol as string, expUnix);

    let { calls, puts } = chain;

    if (params.side === "call") {
      puts = [];
    } else if (params.side === "put") {
      calls = [];
    }

    const limit = Math.min((params.limit as number) ?? 50, 200);
    calls = calls.slice(0, limit);
    puts = puts.slice(0, limit);

    return successResult(JSON.stringify({
      ...chain,
      calls,
      puts,
    }, null, 2));
  }, metadata),
};

const unusualActivityTool: ToolDefinition = {
  name: "options_unusual_activity",
  description:
    "Find options contracts with unusually high volume relative to open interest " +
    "(a common 'smart money' signal). Scans the nearest expiration and flags " +
    "contracts where volume/OI exceeds a threshold.",
  inputSchema: z.object({
    symbol: symbolSchema,
    volume_oi_ratio: z.number().optional()
      .describe("Min volume/OI ratio to flag as unusual (default: 3.0)"),
    min_volume: z.number().optional()
      .describe("Min absolute volume (default: 100)"),
    side: z.enum(["call", "put", "both"]).optional()
      .describe("Filter by option type (default: both)"),
  }),
  handler: withMetadata(async (params) => {
    const chain = await fetchOptionChain(params.symbol as string);
    const minRatio = (params.volume_oi_ratio as number) ?? 3.0;
    const minVol = (params.min_volume as number) ?? 100;
    const minOI = 10;

    const allContracts = [
      ...chain.calls.map(c => ({ ...c, side: "call" as const })),
      ...chain.puts.map(c => ({ ...c, side: "put" as const })),
    ];

    let unusual = allContracts
      .filter(c => c.volume >= minVol && c.openInterest >= minOI)
      .map(c => ({
        ...c,
        volumeOiRatio: Math.round((c.volume / c.openInterest) * 100) / 100,
      }))
      .filter(c => c.volumeOiRatio >= minRatio);

    if (params.side && params.side !== "both") {
      unusual = unusual.filter(c => c.side === params.side);
    }

    unusual.sort((a, b) => b.volume - a.volume);
    unusual = unusual.slice(0, 20);

    return successResult(JSON.stringify({
      symbol: chain.underlyingSymbol,
      underlyingPrice: chain.underlyingPrice,
      unusual,
    }, null, 2));
  }, metadata),
};

const maxPainTool: ToolDefinition = {
  name: "options_max_pain",
  description:
    "Calculate the max pain strike price — where cumulative option open interest expires worthless. " +
    "This level often acts as a support/resistance zone near expiration.",
  inputSchema: z.object({
    symbol: symbolSchema,
    expiration: z.string().optional()
      .describe("Expiration date as YYYY-MM-DD. If omitted, uses nearest."),
  }),
  handler: withMetadata(async (params) => {
    const expUnix = parseExpiration(params.expiration as string | undefined);
    const chain = await fetchOptionChain(params.symbol as string, expUnix);
    const expDate = chain.expirationDates[0]
      ? new Date(chain.expirationDates[0] * 1000).toISOString().split("T")[0]
      : "unknown";

    return successResult(JSON.stringify({
      symbol: chain.underlyingSymbol,
      underlyingPrice: chain.underlyingPrice,
      expiration: expDate,
      maxPain: chain.maxPain,
    }, null, 2));
  }, metadata),
};

export function createOptionsModule(): ModuleDefinition {
  return {
    name: "options",
    description: "Stock options chains, Greeks, unusual activity, and max pain from Yahoo Finance (no API key required)",
    requiredEnvVars: [],
    tools: [expirationsTool, chainTool, unusualActivityTool, maxPainTool],
  };
}
```

### Step 2: Run build

```bash
npm run build
```

### Step 3: Commit

```bash
git add src/modules/options/index.ts
git commit -m "fix: add input validation, 15min metadata, limit, unusual activity, YYYY-MM-DD expiration"
```

---

## Task 4: Restore options-cboe Module (Stream B — Independent)

**Files:**
- Restore: `src/modules/options-cboe/cboe.ts` (from main)
- Restore: `src/modules/options-cboe/index.ts` (from main)
- Restore: `src/modules/options-cboe/__tests__/cboe.test.ts` (from main)
- Modify: `src/index.ts` — re-register options-cboe

### Step 1: Restore files from main

```bash
git checkout main -- src/modules/options-cboe/
```

### Step 2: Register options-cboe in src/index.ts

Add import:
```typescript
import { createOptionsCboeModule } from "./modules/options-cboe/index.js";
```

Add to `buildModules()` array (after `createOptionsModule()`):
```typescript
    createOptionsCboeModule(),
```

Update help text tool count and add options-cboe line.

### Step 3: Run tests

```bash
npx vitest run src/modules/options-cboe/
```

Expected: 8 tests PASS (from the already-proven cboe.test.ts).

### Step 4: Commit

```bash
git add src/modules/options-cboe/ src/index.ts
git commit -m "feat: restore options-cboe module (CBOE put/call ratios, no API key)"
```

---

## Task 5: Write Tests (Stream A — after Tasks 1-3)

**Files:**
- Create: `src/modules/options/__tests__/greeks.test.ts`
- Rewrite: `src/modules/options/__tests__/client.test.ts`
- Rewrite: `src/modules/options/__tests__/index.test.ts`
- Rewrite: `src/modules/options/__tests__/max-pain.test.ts`

### Step 1: Write Greeks tests (`greeks.test.ts`)

Test Black-Scholes against known reference values. Use these verified values (AAPL-like: S=180, K=180, T=30/365, r=0.045, v=0.30):

```typescript
import { describe, it, expect } from "vitest";
import { calculateGreeks, calculateMaxPain } from "../greeks.js";

describe("calculateGreeks", () => {
  // ATM call: S=180, K=180, T=30d, r=4.5%, v=30%
  it("calculates ATM call Greeks correctly", () => {
    const g = calculateGreeks(180, 180, 30 / 365, 0.045, 0.30, true);
    expect(g.delta).toBeGreaterThan(0.49);
    expect(g.delta).toBeLessThan(0.56);
    expect(g.gamma).toBeGreaterThan(0);
    expect(g.theta).toBeLessThan(0); // time decay is negative
    expect(g.vega).toBeGreaterThan(0);
  });

  it("calculates ATM put Greeks correctly", () => {
    const g = calculateGreeks(180, 180, 30 / 365, 0.045, 0.30, false);
    expect(g.delta).toBeGreaterThan(-0.51);
    expect(g.delta).toBeLessThan(-0.44);
    expect(g.gamma).toBeGreaterThan(0); // same as call gamma
    expect(g.theta).toBeLessThan(0);
    expect(g.vega).toBeGreaterThan(0); // same as call vega
  });

  it("deep ITM call has delta near 1", () => {
    const g = calculateGreeks(200, 100, 30 / 365, 0.045, 0.30, true);
    expect(g.delta).toBeGreaterThan(0.99);
  });

  it("deep OTM call has delta near 0", () => {
    const g = calculateGreeks(100, 200, 30 / 365, 0.045, 0.30, true);
    expect(g.delta).toBeLessThan(0.01);
  });

  it("returns zeros when T <= 0", () => {
    const g = calculateGreeks(180, 180, 0, 0.045, 0.30, true);
    expect(g).toEqual({ delta: 0, gamma: 0, theta: 0, vega: 0 });
  });

  it("returns zeros when v <= 0", () => {
    const g = calculateGreeks(180, 180, 30 / 365, 0.045, 0, true);
    expect(g).toEqual({ delta: 0, gamma: 0, theta: 0, vega: 0 });
  });

  it("returns zeros when S <= 0", () => {
    const g = calculateGreeks(0, 180, 30 / 365, 0.045, 0.30, true);
    expect(g).toEqual({ delta: 0, gamma: 0, theta: 0, vega: 0 });
  });

  it("returns zeros when K <= 0", () => {
    const g = calculateGreeks(180, 0, 30 / 365, 0.045, 0.30, true);
    expect(g).toEqual({ delta: 0, gamma: 0, theta: 0, vega: 0 });
  });

  it("put-call parity: call delta - put delta = 1", () => {
    const callG = calculateGreeks(180, 180, 30 / 365, 0.045, 0.30, true);
    const putG = calculateGreeks(180, 180, 30 / 365, 0.045, 0.30, false);
    expect(callG.delta - putG.delta).toBeCloseTo(1.0, 2);
  });

  it("call and put have same gamma", () => {
    const callG = calculateGreeks(180, 180, 30 / 365, 0.045, 0.30, true);
    const putG = calculateGreeks(180, 180, 30 / 365, 0.045, 0.30, false);
    expect(callG.gamma).toBeCloseTo(putG.gamma, 4);
  });

  it("call and put have same vega", () => {
    const callG = calculateGreeks(180, 180, 30 / 365, 0.045, 0.30, true);
    const putG = calculateGreeks(180, 180, 30 / 365, 0.045, 0.30, false);
    expect(callG.vega).toBeCloseTo(putG.vega, 4);
  });
});
```

### Step 2: Write client tests (`client.test.ts`)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const MOCK_YAHOO_RESPONSE = {
  optionChain: {
    result: [{
      underlyingSymbol: "AAPL",
      expirationDates: [1742515200, 1743120000],
      strikes: [170, 175, 180, 185, 190],
      quote: { regularMarketPrice: 180.25 },
      options: [{
        expirationDate: 1742515200,
        calls: [
          { contractSymbol: "AAPL260320C00180000", strike: 180, lastPrice: 5.5, bid: 5.4, ask: 5.6, change: 0.5, percentChange: 10, volume: 1234, openInterest: 5678, impliedVolatility: 0.32, inTheMoney: true },
        ],
        puts: [
          { contractSymbol: "AAPL260320P00180000", strike: 180, lastPrice: 4.2, bid: 4.1, ask: 4.3, change: -0.3, percentChange: -5, volume: 987, openInterest: 4321, impliedVolatility: 0.30, inTheMoney: false },
        ],
      }],
    }],
  },
};

describe("fetchOptionChain", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and maps Yahoo response correctly", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => MOCK_YAHOO_RESPONSE,
    });

    const { fetchOptionChain } = await import("../client.js");
    const chain = await fetchOptionChain("AAPL");

    expect(chain.underlyingSymbol).toBe("AAPL");
    expect(chain.underlyingPrice).toBe(180.25);
    expect(chain.calls).toHaveLength(1);
    expect(chain.puts).toHaveLength(1);
    expect(chain.calls[0].strike).toBe(180);
    expect(chain.calls[0].delta).not.toBeNull();
    expect(chain.maxPain).toBeDefined();
  });

  it("encodes symbol in URL", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => MOCK_YAHOO_RESPONSE,
    });

    const { fetchOptionChain } = await import("../client.js");
    await fetchOptionChain("BRK.B");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("BRK.B");
    expect(calledUrl).toContain("query1.finance.yahoo.com");
  });

  it("resolves ticker — strips exchange prefix", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => MOCK_YAHOO_RESPONSE,
    });

    const { fetchOptionChain } = await import("../client.js");
    await fetchOptionChain("nyse:gm");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("/GM");
    expect(calledUrl).not.toContain("nyse");
  });

  it("throws on missing result", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ optionChain: { result: [] } }),
    });

    const { fetchOptionChain } = await import("../client.js");
    await expect(fetchOptionChain("INVALID")).rejects.toThrow("No options data");
  });

  it("throws on missing quote price", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        optionChain: { result: [{ quote: {}, options: [{}], expirationDates: [], strikes: [] }] },
      }),
    });

    const { fetchOptionChain } = await import("../client.js");
    await expect(fetchOptionChain("AAPL")).rejects.toThrow("No price data");
  });

  it("propagates HTTP errors", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "not found",
    });

    const { fetchOptionChain } = await import("../client.js");
    await expect(fetchOptionChain("AAPL")).rejects.toThrow("HTTP 404");
  });
});
```

### Step 3: Rewrite max-pain tests (`max-pain.test.ts`)

```typescript
import { describe, it, expect } from "vitest";
import { calculateMaxPain } from "../greeks.js";

describe("calculateMaxPain", () => {
  it("finds max pain at strike with minimum total payout", () => {
    const strikes = [95, 100, 105];
    const calls = [
      { strike: 95, openInterest: 1000 },
      { strike: 100, openInterest: 200 },
      { strike: 105, openInterest: 100 },
    ];
    const puts = [
      { strike: 95, openInterest: 100 },
      { strike: 100, openInterest: 200 },
      { strike: 105, openInterest: 1000 },
    ];
    expect(calculateMaxPain(strikes, calls, puts)).toBe(100);
  });

  it("handles all calls, no puts — max pain at lowest strike", () => {
    const strikes = [90, 95, 100];
    const calls = [
      { strike: 90, openInterest: 500 },
      { strike: 95, openInterest: 300 },
      { strike: 100, openInterest: 200 },
    ];
    expect(calculateMaxPain(strikes, calls, [])).toBe(90);
  });

  it("handles all puts, no calls — max pain at highest strike", () => {
    const strikes = [90, 95, 100];
    const puts = [
      { strike: 90, openInterest: 500 },
      { strike: 95, openInterest: 300 },
      { strike: 100, openInterest: 200 },
    ];
    expect(calculateMaxPain(strikes, [], puts)).toBe(100);
  });

  it("returns 0 for empty strikes", () => {
    expect(calculateMaxPain([], [], [])).toBe(0);
  });

  it("handles zero open interest", () => {
    const strikes = [100, 105];
    const calls = [{ strike: 100, openInterest: 0 }, { strike: 105, openInterest: 0 }];
    const puts = [{ strike: 100, openInterest: 0 }, { strike: 105, openInterest: 0 }];
    const result = calculateMaxPain(strikes, calls, puts);
    expect(result).toBe(100); // first strike wins when all tied at 0
  });
});
```

### Step 4: Write handler tests (`index.test.ts`)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../client.js", () => ({
  fetchOptionChain: vi.fn(),
}));

import { createOptionsModule } from "../index.js";
import { fetchOptionChain } from "../client.js";

const mockChain = {
  underlyingSymbol: "AAPL",
  underlyingPrice: 180.25,
  expirationDates: [1742515200],
  strikes: [175, 180, 185],
  calls: [
    { symbol: "C1", strike: 175, volume: 5000, openInterest: 1000, delta: 0.6, gamma: 0.03, theta: -0.05, vega: 0.2, lastPrice: 8, bid: 7.9, ask: 8.1, change: 0, percentChange: 0, impliedVolatility: 0.3, inTheMoney: true },
    { symbol: "C2", strike: 180, volume: 200, openInterest: 5000, delta: 0.5, gamma: 0.03, theta: -0.05, vega: 0.2, lastPrice: 5, bid: 4.9, ask: 5.1, change: 0, percentChange: 0, impliedVolatility: 0.3, inTheMoney: false },
    { symbol: "C3", strike: 185, volume: 50, openInterest: 3, delta: 0.3, gamma: 0.02, theta: -0.03, vega: 0.15, lastPrice: 2, bid: 1.9, ask: 2.1, change: 0, percentChange: 0, impliedVolatility: 0.3, inTheMoney: false },
  ],
  puts: [
    { symbol: "P1", strike: 175, volume: 100, openInterest: 2000, delta: -0.4, gamma: 0.03, theta: -0.04, vega: 0.2, lastPrice: 3, bid: 2.9, ask: 3.1, change: 0, percentChange: 0, impliedVolatility: 0.3, inTheMoney: false },
  ],
  maxPain: 180,
};

describe("createOptionsModule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchOptionChain as ReturnType<typeof vi.fn>).mockResolvedValue(mockChain);
  });

  it("returns module with 4 tools, no required env vars", () => {
    const mod = createOptionsModule();
    expect(mod.name).toBe("options");
    expect(mod.requiredEnvVars).toEqual([]);
    expect(mod.tools).toHaveLength(4);
    expect(mod.tools.map(t => t.name)).toEqual([
      "options_expirations", "options_chain", "options_unusual_activity", "options_max_pain",
    ]);
  });

  it("options_chain respects limit", async () => {
    const mod = createOptionsModule();
    const handler = mod.tools[1].handler;
    const result = await handler({ symbol: "AAPL", limit: 2 });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.calls).toHaveLength(2);
  });

  it("options_chain filters by side=put", async () => {
    const mod = createOptionsModule();
    const handler = mod.tools[1].handler;
    const result = await handler({ symbol: "AAPL", side: "put" });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.calls).toHaveLength(0);
    expect(parsed.puts).toHaveLength(1);
  });

  it("options_unusual_activity flags high vol/OI contracts", async () => {
    const mod = createOptionsModule();
    const handler = mod.tools[2].handler;
    const result = await handler({ symbol: "AAPL" });
    const parsed = JSON.parse(result.content[0].text);
    // C1 has vol=5000, OI=1000 → ratio=5.0 → unusual
    // C2 has vol=200, OI=5000 → ratio=0.04 → normal
    // C3 has vol=50 → below min_volume=100 → filtered
    expect(parsed.unusual.length).toBeGreaterThanOrEqual(1);
    expect(parsed.unusual[0].volumeOiRatio).toBeGreaterThanOrEqual(3.0);
  });

  it("options_max_pain returns max pain strike", async () => {
    const mod = createOptionsModule();
    const handler = mod.tools[3].handler;
    const result = await handler({ symbol: "AAPL" });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.maxPain).toBe(180);
    expect(parsed.symbol).toBe("AAPL");
  });
});
```

### Step 5: Run all tests

```bash
npx vitest run src/modules/options/
```

Expected: All tests pass.

### Step 6: Commit

```bash
git add src/modules/options/__tests__/
git commit -m "test: comprehensive tests for Yahoo options — Greeks, client, handlers, max pain"
```

---

## Task 6: Update Integration Tests & Docs (Stream D — after all)

**Files:**
- Modify: `src/__tests__/integration.test.ts`
- Modify: `src/index.ts` (help text)
- Modify: `CLAUDE.md`
- Modify: `README.md`

### Step 1: Update integration test counts

With options (4 tools) + options-cboe (1 tool) = 5 new free tools. Total free tools: 7+4+6+3+4+1 = 25. With keyed modules: 25+5+5 = 35. Total modules: 8.

Update the test assertions:
- Free modules: `["tradingview", "tradingview-crypto", "sec-edgar", "coingecko", "options", "options-cboe"]`
- Free tools: `25`
- All modules: `8`
- All tools: `35`
- Unique names: `35`

### Step 2: Update help text in `src/index.ts`

```
MODULES (35 tools total)
  tradingview        7 tools  Stock scanning, quotes, technicals       (no key)
  tradingview-crypto 4 tools  Crypto pair scanning and technicals      (no key)
  sec-edgar          6 tools  SEC filings, insider trades, holdings    (no key)
  coingecko          3 tools  Crypto market data and trending          (no key)
  options            4 tools  Options chains, Greeks, unusual activity  (no key)
  options-cboe       1 tool   CBOE put/call ratio sentiment            (no key)
  finnhub            5 tools  Market news, earnings, short interest    (FINNHUB_API_KEY)
  alpha-vantage      5 tools  Stock quotes, fundamentals, dividends    (ALPHA_VANTAGE_API_KEY)
```

### Step 3: Update CLAUDE.md and README.md module tables

Add `options-cboe` row. Update `options` row to show 4 tools and Yahoo Finance. Remove all Tradier references.

### Step 4: Run full test suite

```bash
npm test
```

Expected: All tests pass, no regressions.

### Step 5: Commit

```bash
git add src/__tests__/integration.test.ts src/index.ts CLAUDE.md README.md
git commit -m "docs: update tool counts, module tables, and README for Yahoo options + CBOE"
```

---

## Summary

| Task | Stream | New/Modified Files | Tests Added | Tools |
|------|--------|-------------------|-------------|-------|
| 1 | A | `options/client.ts` | — | — |
| 2 | A | `options/greeks.ts` | — | — |
| 3 | A | `options/index.ts` | — | +1 (unusual_activity) |
| 4 | B | `options-cboe/*` (restore) | +8 (existing) | +1 (put_call_ratio) |
| 5 | A | `options/__tests__/*` | +25 (new) | — |
| 6 | D | integration, docs | update counts | — |
| **Total** | | **10 files** | **~33 tests** | **5 tools (4 options + 1 cboe)** |
