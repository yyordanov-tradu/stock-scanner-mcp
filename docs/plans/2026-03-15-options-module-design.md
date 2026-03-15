# Options Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Add two new modules — `options-cboe` (1 tool, no API key, always enabled) and `options` (4 tools, requires `TRADIER_API_TOKEN`) — providing options chains with Greeks, unusual activity detection, max pain calculation, and market-wide put/call ratios.

**Architecture:** Two independent modules following the existing pattern (`client.ts` + `index.ts`). `options-cboe` fetches free CBOE CSV files for put/call ratios. `options` uses the Tradier Sandbox REST API for options chains, Greeks, IV, and computes unusual activity + max pain server-side from chain data.

**Tech Stack:** TypeScript, zod, vitest, existing shared infra (`httpGet`, `TtlCache`, `withMetadata`, `successResult`).

**Closes:** GitHub issue #37

---

## Parallel Execution Guide

This plan has **4 independent work streams** that can be executed simultaneously by separate agents:

| Work Stream | Tasks | Dependencies |
|-------------|-------|-------------|
| **A: CBOE Module** | Task 1 | None — fully independent |
| **B: Tradier Client** | Task 2 | None — fully independent |
| **C: Max Pain Logic** | Task 3 | None — pure calculation, no API |
| **D: Integration** | Task 4, Task 5 | Requires A + B + C complete |

Streams A, B, and C can run in parallel. Stream D runs after all three finish.

---

## Reference: Key Codebase Patterns

Before implementing, read these files to understand conventions:

- `src/shared/types.ts` — `ModuleDefinition`, `ToolDefinition`, `ToolResult`, `successResult()`, `errorResult()`
- `src/shared/utils.ts` — `withMetadata()` wrapper (handles errors, injects `_meta`)
- `src/shared/http.ts` — `httpGet()` with timeouts and key sanitization
- `src/shared/cache.ts` — `TtlCache` class with `getOrFetch()`
- `src/modules/finnhub/index.ts` — pattern for modules that take an API key parameter
- `src/modules/coingecko/index.ts` — pattern for modules with no API key
- `src/index.ts:23-40` — how modules are registered in `buildModules()`
- `src/modules/finnhub/__tests__/client.test.ts` — test pattern (vi.stubGlobal fetch, mock responses)

---

## Task 1: CBOE Put/Call Ratio Module (Stream A — Independent)

**Files:**
- Create: `src/modules/options-cboe/cboe.ts`
- Create: `src/modules/options-cboe/index.ts`
- Create: `src/modules/options-cboe/__tests__/cboe.test.ts`

### Step 1: Write failing tests for CSV parser

Create `src/modules/options-cboe/__tests__/cboe.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getPutCallRatio } from "../cboe.js";

describe("getPutCallRatio", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches total put/call ratio CSV and parses it", async () => {
    const csvContent = [
      "DATE,CALL,PUT,TOTAL,P/C RATIO",
      "3/14/2026,1500000,1200000,2700000,0.80",
      "3/13/2026,1600000,1100000,2700000,0.69",
      "3/12/2026,1400000,1300000,2700000,0.93",
    ].join("\n");

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => csvContent,
    });

    const result = await getPutCallRatio("total", 3);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("cdn.cboe.com"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result).toHaveLength(3);
    expect(result[0].date).toBe("2026-03-14");
    expect(result[0].putCallRatio).toBe(0.80);
    expect(result[0].callVolume).toBe(1500000);
    expect(result[0].putVolume).toBe(1200000);
    expect(result[0].totalVolume).toBe(2700000);
  });

  it("selects correct CSV URL for each type", async () => {
    const csvContent = "DATE,CALL,PUT,TOTAL,P/C RATIO\n3/14/2026,100,100,200,1.00\n";

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => csvContent,
    });

    await getPutCallRatio("equity", 1);
    const equityUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(equityUrl).toContain("equitypc.csv");

    (fetch as ReturnType<typeof vi.fn>).mockClear();
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => csvContent,
    });

    await getPutCallRatio("index", 1);
    const indexUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(indexUrl).toContain("indexpcarchive.csv");
  });

  it("returns only the requested number of recent days", async () => {
    const lines = ["DATE,CALL,PUT,TOTAL,P/C RATIO"];
    for (let i = 1; i <= 30; i++) {
      lines.push(`3/${i}/2026,1000,1000,2000,1.00`);
    }

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => lines.join("\n"),
    });

    const result = await getPutCallRatio("total", 5);
    expect(result).toHaveLength(5);
  });

  it("handles empty/malformed lines gracefully", async () => {
    const csvContent = [
      "DATE,CALL,PUT,TOTAL,P/C RATIO",
      "3/14/2026,1500000,1200000,2700000,0.80",
      "",
      "bad line",
      "3/13/2026,1600000,1100000,2700000,0.69",
    ].join("\n");

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => csvContent,
    });

    const result = await getPutCallRatio("total", 10);
    expect(result).toHaveLength(2);
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npx vitest run src/modules/options-cboe/__tests__/cboe.test.ts
```

Expected: FAIL — module not found.

### Step 3: Implement `cboe.ts`

Create `src/modules/options-cboe/cboe.ts`:

```typescript
import { TtlCache } from "../../shared/cache.js";

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const FETCH_TIMEOUT = 10_000;

const cache = new TtlCache<PutCallEntry[]>(CACHE_TTL);

const CSV_URLS: Record<string, string> = {
  total: "https://cdn.cboe.com/resources/options/volume_and_call_put_ratios/totalpc.csv",
  equity: "https://cdn.cboe.com/resources/options/volume_and_call_put_ratios/equitypc.csv",
  index: "https://cdn.cboe.com/resources/options/volume_and_call_put_ratios/indexpcarchive.csv",
};

export interface PutCallEntry {
  date: string;
  callVolume: number;
  putVolume: number;
  totalVolume: number;
  putCallRatio: number;
}

function parseDate(mmddyyyy: string): string {
  const parts = mmddyyyy.trim().split("/");
  if (parts.length !== 3) return "";
  const [m, d, y] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseCsv(text: string): PutCallEntry[] {
  const lines = text.split("\n");
  const entries: PutCallEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",");
    if (cols.length < 5) continue;

    const date = parseDate(cols[0]);
    if (!date) continue;

    const callVolume = parseInt(cols[1], 10);
    const putVolume = parseInt(cols[2], 10);
    const totalVolume = parseInt(cols[3], 10);
    const putCallRatio = parseFloat(cols[4]);

    if (isNaN(callVolume) || isNaN(putCallRatio)) continue;

    entries.push({ date, callVolume, putVolume, totalVolume, putCallRatio });
  }

  return entries;
}

export async function getPutCallRatio(
  type: string = "total",
  days: number = 30,
): Promise<PutCallEntry[]> {
  const cacheKey = `pcr:${type}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached.slice(-days).reverse();
  }

  const url = CSV_URLS[type] ?? CSV_URLS.total;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const text = await response.text();
    const entries = parseCsv(text);

    cache.set(cacheKey, entries);
    return entries.slice(-days).reverse();
  } finally {
    clearTimeout(timer);
  }
}
```

### Step 4: Run tests to verify they pass

```bash
npx vitest run src/modules/options-cboe/__tests__/cboe.test.ts
```

Expected: 4 tests PASS.

### Step 5: Write module index with tool definition

Create `src/modules/options-cboe/index.ts`:

```typescript
import { z } from "zod";
import type { ModuleDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import { getPutCallRatio } from "./cboe.js";
import { withMetadata } from "../../shared/utils.js";

export function createOptionsCboeModule(): ModuleDefinition {
  const metadata = { source: "cboe", dataDelay: "end-of-day" };

  return {
    name: "options-cboe",
    description: "CBOE market-wide put/call ratio data — daily sentiment indicator from options volume",
    requiredEnvVars: [],
    tools: [
      {
        name: "options_put_call_ratio",
        description:
          "Get historical put/call ratio from CBOE (market-wide sentiment indicator). " +
          "Ratio > 1.0 = more puts (bearish sentiment), < 0.7 = more calls (bullish/complacent). " +
          "Types: 'total' (all options), 'equity' (stock options only), 'index' (index options only).",
        inputSchema: z.object({
          type: z
            .enum(["total", "equity", "index"])
            .optional()
            .describe("Ratio type (default: total)"),
          days: z
            .number()
            .optional()
            .describe("Number of recent trading days to return (default: 30, max: 252)"),
        }),
        handler: withMetadata(async (params) => {
          const days = Math.min(Math.max((params.days as number) ?? 30, 1), 252);
          const data = await getPutCallRatio(
            (params.type as string) ?? "total",
            days,
          );
          return successResult(JSON.stringify(data, null, 2));
        }, metadata),
      },
    ],
  };
}
```

### Step 6: Write module-level test

Add to `src/modules/options-cboe/__tests__/cboe.test.ts` (at the end):

```typescript
describe("createOptionsCboeModule", () => {
  it("returns module with 1 tool and no required env vars", async () => {
    const { createOptionsCboeModule } = await import("../index.js");
    const mod = createOptionsCboeModule();
    expect(mod.name).toBe("options-cboe");
    expect(mod.requiredEnvVars).toEqual([]);
    expect(mod.tools).toHaveLength(1);
    expect(mod.tools[0].name).toBe("options_put_call_ratio");
  });
});
```

### Step 7: Run all tests

```bash
npx vitest run src/modules/options-cboe/
```

Expected: 5 tests PASS.

### Step 8: Commit

```bash
git add src/modules/options-cboe/
git commit -m "feat: add options-cboe module with put/call ratio tool

Fetches free CBOE CDN CSV data for total, equity, and index
put/call ratios. No API key required. Cached for 30 minutes.

Part of #37"
```

---

## Task 2: Tradier Options Client (Stream B — Independent)

**Files:**
- Create: `src/modules/options/client.ts`
- Create: `src/modules/options/__tests__/client.test.ts`

### Step 1: Write failing tests for `getExpirations()`

Create `src/modules/options/__tests__/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getExpirations, getOptionsChain } from "../client.js";

describe("getExpirations", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches expirations with correct URL and auth header", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        expirations: {
          date: ["2026-03-20", "2026-04-17", "2026-06-19"],
        },
      }),
    });

    const result = await getExpirations("test-token", "AAPL");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("sandbox.tradier.com/v1/markets/options/expirations"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          Accept: "application/json",
        }),
      }),
    );
    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("symbol=AAPL");
    expect(result).toEqual(["2026-03-20", "2026-04-17", "2026-06-19"]);
  });

  it("returns empty array when no expirations found", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ expirations: null }),
    });

    const result = await getExpirations("test-token", "INVALID");
    expect(result).toEqual([]);
  });
});

describe("getOptionsChain", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches chain with greeks enabled and maps response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        options: {
          option: [
            {
              symbol: "AAPL260320C00200000",
              description: "AAPL Mar 20 2026 200.00 Call",
              strike: 200.0,
              option_type: "call",
              last: 5.50,
              bid: 5.40,
              ask: 5.60,
              volume: 1234,
              open_interest: 5678,
              greeks: {
                delta: 0.55,
                gamma: 0.03,
                theta: -0.12,
                vega: 0.25,
                mid_iv: 0.32,
              },
            },
            {
              symbol: "AAPL260320P00200000",
              description: "AAPL Mar 20 2026 200.00 Put",
              strike: 200.0,
              option_type: "put",
              last: 4.20,
              bid: 4.10,
              ask: 4.30,
              volume: 987,
              open_interest: 4321,
              greeks: {
                delta: -0.45,
                gamma: 0.03,
                theta: -0.10,
                vega: 0.24,
                mid_iv: 0.30,
              },
            },
          ],
        },
      }),
    });

    const result = await getOptionsChain("test-token", "AAPL", "2026-03-20");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("symbol=AAPL");
    expect(calledUrl).toContain("expiration=2026-03-20");
    expect(calledUrl).toContain("greeks=true");

    expect(result).toHaveLength(2);
    expect(result[0].strike).toBe(200.0);
    expect(result[0].optionType).toBe("call");
    expect(result[0].delta).toBe(0.55);
    expect(result[0].iv).toBe(0.32);
    expect(result[0].volume).toBe(1234);
    expect(result[0].openInterest).toBe(5678);

    expect(result[1].optionType).toBe("put");
    expect(result[1].delta).toBe(-0.45);
  });

  it("returns empty array when no options found", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ options: null }),
    });

    const result = await getOptionsChain("test-token", "INVALID", "2026-03-20");
    expect(result).toEqual([]);
  });

  it("handles single option (non-array response)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        options: {
          option: {
            symbol: "AAPL260320C00200000",
            strike: 200.0,
            option_type: "call",
            last: 5.50,
            bid: 5.40,
            ask: 5.60,
            volume: 100,
            open_interest: 500,
            greeks: { delta: 0.5, gamma: 0.03, theta: -0.1, vega: 0.2, mid_iv: 0.3 },
          },
        },
      }),
    });

    const result = await getOptionsChain("test-token", "AAPL", "2026-03-20");
    expect(result).toHaveLength(1);
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npx vitest run src/modules/options/__tests__/client.test.ts
```

Expected: FAIL — module not found.

### Step 3: Implement `client.ts`

Create `src/modules/options/client.ts`:

```typescript
import { TtlCache } from "../../shared/cache.js";

const BASE_URL = "https://sandbox.tradier.com/v1/markets/options";
const CHAIN_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const EXPIRY_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT = 10_000;

const chainCache = new TtlCache<OptionContract[]>(CHAIN_CACHE_TTL);
const expiryCache = new TtlCache<string[]>(EXPIRY_CACHE_TTL);

export interface OptionContract {
  symbol: string;
  strike: number;
  optionType: string;
  expiration: string;
  last: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
}

function tradierFetch(url: string, token: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

export async function getExpirations(
  token: string,
  symbol: string,
): Promise<string[]> {
  const cacheKey = `exp:${symbol}`;
  const cached = expiryCache.get(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/expirations?symbol=${encodeURIComponent(symbol)}`;
  const response = await tradierFetch(url, token);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const dates: string[] = data?.expirations?.date ?? [];

  expiryCache.set(cacheKey, dates);
  return dates;
}

function mapContract(raw: any, expiration: string): OptionContract {
  const greeks = raw.greeks ?? {};
  return {
    symbol: raw.symbol ?? "",
    strike: raw.strike ?? 0,
    optionType: raw.option_type ?? "",
    expiration: raw.expiration_date ?? expiration,
    last: raw.last ?? 0,
    bid: raw.bid ?? 0,
    ask: raw.ask ?? 0,
    volume: raw.volume ?? 0,
    openInterest: raw.open_interest ?? 0,
    delta: greeks.delta ?? 0,
    gamma: greeks.gamma ?? 0,
    theta: greeks.theta ?? 0,
    vega: greeks.vega ?? 0,
    iv: greeks.mid_iv ?? 0,
  };
}

export async function getOptionsChain(
  token: string,
  symbol: string,
  expiration: string,
): Promise<OptionContract[]> {
  const cacheKey = `chain:${symbol}:${expiration}`;
  const cached = chainCache.get(cacheKey);
  if (cached) return cached;

  const url =
    `${BASE_URL}/chains?symbol=${encodeURIComponent(symbol)}` +
    `&expiration=${encodeURIComponent(expiration)}&greeks=true`;

  const response = await tradierFetch(url, token);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const raw = data?.options?.option;

  if (!raw) return [];

  const options = Array.isArray(raw) ? raw : [raw];
  const contracts = options.map((o: any) => mapContract(o, expiration));

  chainCache.set(cacheKey, contracts);
  return contracts;
}
```

### Step 4: Run tests to verify they pass

```bash
npx vitest run src/modules/options/__tests__/client.test.ts
```

Expected: 5 tests PASS.

### Step 5: Commit

```bash
git add src/modules/options/client.ts src/modules/options/__tests__/client.test.ts
git commit -m "feat: add Tradier options client with chain and expirations

Uses Tradier Sandbox API (free, 60 req/min) for options chains
with Greeks (delta, gamma, theta, vega) and implied volatility.
Includes caching: 2min for chains, 1hr for expirations.

Part of #37"
```

---

## Task 3: Max Pain Calculator (Stream C — Independent)

**Files:**
- Create: `src/modules/options/max-pain.ts`
- Create: `src/modules/options/__tests__/max-pain.test.ts`

### Step 1: Write failing tests

Create `src/modules/options/__tests__/max-pain.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculateMaxPain } from "../max-pain.js";
import type { OptionContract } from "../client.js";

function makeContract(
  strike: number,
  optionType: string,
  openInterest: number,
): OptionContract {
  return {
    symbol: `TEST${strike}${optionType[0].toUpperCase()}`,
    strike,
    optionType,
    expiration: "2026-03-20",
    last: 1, bid: 1, ask: 1,
    volume: 100, openInterest,
    delta: 0, gamma: 0, theta: 0, vega: 0, iv: 0.3,
  };
}

describe("calculateMaxPain", () => {
  it("finds max pain at the strike with minimum total payout", () => {
    // Setup: strikes at 95, 100, 105
    // Heavy call OI at 95 (ITM calls if price > 95) → pushes pain up at high prices
    // Heavy put OI at 105 (ITM puts if price < 105) → pushes pain up at low prices
    // Max pain should be at 100 where least total pain
    const contracts: OptionContract[] = [
      makeContract(95, "call", 1000),
      makeContract(100, "call", 200),
      makeContract(105, "call", 100),
      makeContract(95, "put", 100),
      makeContract(100, "put", 200),
      makeContract(105, "put", 1000),
    ];

    const result = calculateMaxPain(contracts);

    expect(result.maxPainStrike).toBe(100);
    expect(result.painCurve).toHaveLength(3);
    expect(result.painCurve.find(p => p.strike === 100)!.totalPain).toBeLessThan(
      result.painCurve.find(p => p.strike === 95)!.totalPain,
    );
    expect(result.painCurve.find(p => p.strike === 100)!.totalPain).toBeLessThan(
      result.painCurve.find(p => p.strike === 105)!.totalPain,
    );
  });

  it("handles all calls (no puts)", () => {
    const contracts: OptionContract[] = [
      makeContract(100, "call", 500),
      makeContract(110, "call", 300),
      makeContract(120, "call", 100),
    ];

    const result = calculateMaxPain(contracts);
    // Max pain should be at highest strike (all calls expire worthless)
    expect(result.maxPainStrike).toBe(120);
  });

  it("handles empty contracts", () => {
    const result = calculateMaxPain([]);
    expect(result.maxPainStrike).toBe(0);
    expect(result.painCurve).toEqual([]);
  });

  it("handles contracts with zero open interest", () => {
    const contracts: OptionContract[] = [
      makeContract(100, "call", 0),
      makeContract(100, "put", 0),
    ];

    const result = calculateMaxPain(contracts);
    expect(result.maxPainStrike).toBe(100);
  });

  it("returns pain curve sorted by strike", () => {
    const contracts: OptionContract[] = [
      makeContract(110, "call", 100),
      makeContract(90, "call", 100),
      makeContract(100, "call", 100),
      makeContract(110, "put", 100),
      makeContract(90, "put", 100),
      makeContract(100, "put", 100),
    ];

    const result = calculateMaxPain(contracts);
    const strikes = result.painCurve.map(p => p.strike);
    expect(strikes).toEqual([...strikes].sort((a, b) => a - b));
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npx vitest run src/modules/options/__tests__/max-pain.test.ts
```

Expected: FAIL — module not found.

### Step 3: Implement `max-pain.ts`

Create `src/modules/options/max-pain.ts`:

```typescript
import type { OptionContract } from "./client.js";

export interface PainPoint {
  strike: number;
  callPain: number;
  putPain: number;
  totalPain: number;
}

export interface MaxPainResult {
  maxPainStrike: number;
  painCurve: PainPoint[];
}

export function calculateMaxPain(contracts: OptionContract[]): MaxPainResult {
  if (contracts.length === 0) {
    return { maxPainStrike: 0, painCurve: [] };
  }

  const calls = contracts.filter(c => c.optionType === "call");
  const puts = contracts.filter(c => c.optionType === "put");

  // Collect unique strikes
  const strikeSet = new Set<number>();
  for (const c of contracts) strikeSet.add(c.strike);
  const strikes = [...strikeSet].sort((a, b) => a - b);

  // For each candidate expiry price (each strike), calculate total payout
  const painCurve: PainPoint[] = strikes.map(candidate => {
    // Call payout: if stock closes at `candidate`, each call with strike < candidate
    // pays (candidate - strike) * OI to holders
    let callPain = 0;
    for (const call of calls) {
      if (candidate > call.strike) {
        callPain += (candidate - call.strike) * call.openInterest;
      }
    }

    // Put payout: if stock closes at `candidate`, each put with strike > candidate
    // pays (strike - candidate) * OI to holders
    let putPain = 0;
    for (const put of puts) {
      if (candidate < put.strike) {
        putPain += (put.strike - candidate) * put.openInterest;
      }
    }

    return {
      strike: candidate,
      callPain: Math.round(callPain * 100) / 100,
      putPain: Math.round(putPain * 100) / 100,
      totalPain: Math.round((callPain + putPain) * 100) / 100,
    };
  });

  // Max pain = strike where total payout to option holders is MINIMIZED
  let minPain = Infinity;
  let maxPainStrike = strikes[0];
  for (const point of painCurve) {
    if (point.totalPain < minPain) {
      minPain = point.totalPain;
      maxPainStrike = point.strike;
    }
  }

  return { maxPainStrike, painCurve };
}
```

### Step 4: Run tests to verify they pass

```bash
npx vitest run src/modules/options/__tests__/max-pain.test.ts
```

Expected: 5 tests PASS.

### Step 5: Commit

```bash
git add src/modules/options/max-pain.ts src/modules/options/__tests__/max-pain.test.ts
git commit -m "feat: add max pain calculator from open interest data

Pure calculation module — finds the strike price where total
option holder payout is minimized. Returns full pain curve
across all strikes.

Part of #37"
```

---

## Task 4: Options Module Index — 4 Tools (Stream D — Requires Tasks 2 + 3)

**Files:**
- Create: `src/modules/options/index.ts`
- Create: `src/modules/options/__tests__/index.test.ts`
- Modify: `src/index.ts:17-39` (register both new modules)

### Step 1: Create module index with 4 tool definitions

Create `src/modules/options/index.ts`:

```typescript
import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import { getExpirations, getOptionsChain } from "./client.js";
import { calculateMaxPain } from "./max-pain.js";
import { withMetadata } from "../../shared/utils.js";

export function createOptionsModule(apiToken: string): ModuleDefinition {
  const metadata = { source: "tradier", dataDelay: "15min" };

  const chainTool: ToolDefinition = {
    name: "options_chain",
    description:
      "Get the full options chain for a stock ticker and expiration date, " +
      "including Greeks (delta, gamma, theta, vega) and implied volatility. " +
      "Use options_expirations first to find valid expiration dates.",
    inputSchema: z.object({
      symbol: z.string().describe("Underlying stock ticker (e.g. 'AAPL')"),
      expiration: z.string().describe("Expiration date (YYYY-MM-DD)"),
      side: z
        .enum(["call", "put", "both"])
        .optional()
        .describe("Filter by option type (default: both)"),
      min_open_interest: z
        .number()
        .optional()
        .describe("Minimum open interest filter (default: 0)"),
      limit: z
        .number()
        .optional()
        .describe("Max contracts to return (default: 50)"),
    }),
    handler: withMetadata(async (params) => {
      const symbol = (params.symbol as string).toUpperCase();
      let chain = await getOptionsChain(apiToken, symbol, params.expiration as string);

      if (params.side && params.side !== "both") {
        chain = chain.filter(c => c.optionType === params.side);
      }

      const minOI = (params.min_open_interest as number) ?? 0;
      if (minOI > 0) {
        chain = chain.filter(c => c.openInterest >= minOI);
      }

      const limit = (params.limit as number) ?? 50;
      chain = chain.slice(0, limit);

      return successResult(JSON.stringify(chain, null, 2));
    }, metadata),
  };

  const expirationsTool: ToolDefinition = {
    name: "options_expirations",
    description:
      "List all available expiration dates for a stock's options. " +
      "Call this first before using options_chain to find valid dates.",
    inputSchema: z.object({
      symbol: z.string().describe("Underlying stock ticker (e.g. 'AAPL')"),
    }),
    handler: withMetadata(async (params) => {
      const symbol = (params.symbol as string).toUpperCase();
      const dates = await getExpirations(apiToken, symbol);
      return successResult(JSON.stringify(dates, null, 2));
    }, metadata),
  };

  const unusualActivityTool: ToolDefinition = {
    name: "options_unusual_activity",
    description:
      "Find options contracts with unusually high volume relative to open interest " +
      "(a common 'smart money' signal). Scans the nearest 2 expirations and flags " +
      "contracts where volume/OI exceeds a threshold.",
    inputSchema: z.object({
      symbol: z.string().describe("Underlying stock ticker (e.g. 'AAPL')"),
      volume_oi_ratio: z
        .number()
        .optional()
        .describe("Min volume/OI ratio to flag as unusual (default: 3.0)"),
      min_volume: z
        .number()
        .optional()
        .describe("Min absolute volume (default: 100)"),
      side: z
        .enum(["call", "put", "both"])
        .optional()
        .describe("Filter by option type (default: both)"),
    }),
    handler: withMetadata(async (params) => {
      const symbol = (params.symbol as string).toUpperCase();
      const minRatio = (params.volume_oi_ratio as number) ?? 3.0;
      const minVol = (params.min_volume as number) ?? 100;

      // Get nearest 2 expirations
      const expirations = await getExpirations(apiToken, symbol);
      const nearestExps = expirations.slice(0, 2);

      if (nearestExps.length === 0) {
        return successResult(JSON.stringify({ symbol, unusual: [], message: "No options available" }));
      }

      // Fetch chains for each expiration
      const allContracts = [];
      for (const exp of nearestExps) {
        const chain = await getOptionsChain(apiToken, symbol, exp);
        allContracts.push(...chain);
      }

      // Filter for unusual activity
      let unusual = allContracts
        .filter(c => c.volume >= minVol && c.openInterest > 0)
        .map(c => ({
          ...c,
          volumeOiRatio: Math.round((c.volume / c.openInterest) * 100) / 100,
        }))
        .filter(c => c.volumeOiRatio >= minRatio);

      if (params.side && params.side !== "both") {
        unusual = unusual.filter(c => c.optionType === params.side);
      }

      // Sort by volume descending, return top 20
      unusual.sort((a, b) => b.volume - a.volume);
      unusual = unusual.slice(0, 20);

      return successResult(JSON.stringify({ symbol, unusual }, null, 2));
    }, metadata),
  };

  const maxPainTool: ToolDefinition = {
    name: "options_max_pain",
    description:
      "Calculate the max pain strike price for an expiration date. " +
      "Max pain is the strike where option writers' total payout is minimized " +
      "(the price where most options expire worthless). Useful for predicting " +
      "where market makers may pin the stock near expiration.",
    inputSchema: z.object({
      symbol: z.string().describe("Underlying stock ticker (e.g. 'AAPL')"),
      expiration: z.string().describe("Expiration date (YYYY-MM-DD)"),
    }),
    handler: withMetadata(async (params) => {
      const symbol = (params.symbol as string).toUpperCase();
      const chain = await getOptionsChain(apiToken, symbol, params.expiration as string);
      const result = calculateMaxPain(chain);

      return successResult(JSON.stringify({
        symbol,
        expiration: params.expiration,
        maxPainStrike: result.maxPainStrike,
        painCurve: result.painCurve,
      }, null, 2));
    }, metadata),
  };

  return {
    name: "options",
    description:
      "Options chains with Greeks, unusual activity detection, and max pain calculator via Tradier API",
    requiredEnvVars: ["TRADIER_API_TOKEN"],
    tools: [chainTool, expirationsTool, unusualActivityTool, maxPainTool],
  };
}
```

### Step 2: Write module-level test

Create `src/modules/options/__tests__/index.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createOptionsModule } from "../index.js";

describe("createOptionsModule", () => {
  it("returns module with 4 tools and requires TRADIER_API_TOKEN", () => {
    const mod = createOptionsModule("test-token");
    expect(mod.name).toBe("options");
    expect(mod.requiredEnvVars).toEqual(["TRADIER_API_TOKEN"]);
    expect(mod.tools).toHaveLength(4);
    expect(mod.tools.map(t => t.name)).toEqual([
      "options_chain",
      "options_expirations",
      "options_unusual_activity",
      "options_max_pain",
    ]);
  });
});
```

### Step 3: Run module tests

```bash
npx vitest run src/modules/options/
```

Expected: 11 tests PASS (5 client + 5 max-pain + 1 index).

### Step 4: Register both modules in `src/index.ts`

Add imports after line 21:

```typescript
import { createOptionsCboeModule } from "./modules/options-cboe/index.js";
import { createOptionsModule } from "./modules/options/index.js";
```

In `buildModules()`, add `createOptionsCboeModule()` to the always-on array (after `createCoingeckoModule()` on line 28):

```typescript
    createOptionsCboeModule(),
```

Add after the `ALPHA_VANTAGE_API_KEY` block (after line 37):

```typescript
  if (env.TRADIER_API_TOKEN) {
    modules.push(createOptionsModule(env.TRADIER_API_TOKEN));
  }
```

Update the `printHelp()` function — add to the MODULES section:

```
  options-cboe     1 tool   CBOE put/call ratio sentiment        (no key)
  options          4 tools  Options chains, Greeks, max pain      (TRADIER_API_TOKEN)
```

Update the tool count in the MODULES header from `30 tools total` to `35 tools total`.

Add `TRADIER_API_TOKEN` to the env section in the help text.

### Step 5: Run full test suite

```bash
npx vitest run
```

Expected: All tests pass, no regressions.

### Step 6: Commit

```bash
git add src/modules/options/index.ts src/modules/options/__tests__/index.test.ts src/index.ts
git commit -m "feat: register options and options-cboe modules

options-cboe (1 tool, no key): CBOE put/call ratios
options (4 tools, TRADIER_API_TOKEN): chains, expirations,
unusual activity, max pain

Total tools: 30 → 35

Part of #37"
```

---

## Task 5: Update README & CLAUDE.md (Stream D — After Task 4)

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

### Step 1: Update README.md

Add to the Module table:

```markdown
| options-cboe | 1 | None | CBOE market-wide put/call ratio (sentiment indicator) |
| options | 4 | `TRADIER_API_TOKEN` | Options chains, Greeks, unusual activity, max pain |
```

Add new tool tables:

```markdown
### CBOE Options Sentiment (no API key)

| Tool | Description |
|------|-------------|
| `options_put_call_ratio` | Historical put/call ratio from CBOE (total, equity, or index) |

### Options — Chains, Greeks & Analysis (requires `TRADIER_API_TOKEN`)

| Tool | Description |
|------|-------------|
| `options_chain` | Full options chain with Greeks (delta, gamma, theta, vega) and IV |
| `options_expirations` | List available expiration dates for a stock's options |
| `options_unusual_activity` | Find contracts with unusual volume/OI ratio (smart money signals) |
| `options_max_pain` | Calculate max pain strike price from open interest data |
```

Update "Available Tools" header from `30 total` to `35 total`.

Add `TRADIER_API_TOKEN` to the Configuration table:

```markdown
| `TRADIER_API_TOKEN` | No | Enables Options module ([free sandbox](https://developer.tradier.com/)) |
```

Update Architecture section — add:

```
│   ├── options-cboe/    # 1 tool — CBOE put/call ratios
│   ├── options/         # 4 tools — chains, Greeks, unusual activity, max pain
```

Update Rate Limits table — add:

```
| Tradier Sandbox | 60 calls/minute | 2 min (chains), 1 hr (expirations) |
| CBOE CDN | No documented limit | 30 min |
```

Add example usage lines:

```
- "What's the options chain for AAPL expiring next Friday?"
- "Any unusual options activity on TSLA?"
- "What's the max pain for SPY this week?"
- "Show me the put/call ratio trend for the last 30 days"
```

Update the MCP config example to include TRADIER_API_TOKEN.

### Step 2: Update CLAUDE.md

Add to the Module Status table:

```markdown
| options-cboe | (none) | Always |
| options | TRADIER_API_TOKEN | When key set |
```

Add `TRADIER_API_TOKEN` to the Environment Variables section.

Update tool count from 30 to 35 in the project structure.

Add to the Architecture section:

```
│   ├── options-cboe/    # 1 tool — CBOE put/call ratios
│   ├── options/         # 4 tools — chains, Greeks, unusual activity, max pain
```

### Step 3: Run tests one final time

```bash
npx vitest run
```

### Step 4: Commit

```bash
git add README.md CLAUDE.md
git commit -m "docs: add options modules to README and CLAUDE.md

Documents 5 new tools across 2 modules (options-cboe, options),
API setup instructions, rate limits, and usage examples.

Closes #37"
```

---

## Summary

| Task | Stream | Files Created | Tests | Tools |
|------|--------|--------------|-------|-------|
| 1 | A (independent) | `options-cboe/cboe.ts`, `options-cboe/index.ts` | 5 | 1 |
| 2 | B (independent) | `options/client.ts` | 5 | — |
| 3 | C (independent) | `options/max-pain.ts` | 5 | — |
| 4 | D (after A+B+C) | `options/index.ts`, modify `src/index.ts` | 1 | 4 |
| 5 | D (after 4) | modify `README.md`, `CLAUDE.md` | — | — |
| **Total** | | **7 new files** | **16 tests** | **5 tools** |
