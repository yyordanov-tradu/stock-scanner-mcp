# Sentiment Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `sentiment` module with 2 tools providing market Fear & Greed data (CNN) and crypto Fear & Greed data (alternative.me).

**Architecture:** New module `src/modules/sentiment/` following the standard pattern (index.ts + client.ts + tests). No API key required — always auto-enabled like tradingview/coingecko. CNN endpoint requires custom browser headers (User-Agent + Referer). Alternative.me is a clean public API.

**Tech Stack:** TypeScript, Zod, shared/http.ts (httpGet with custom headers), shared/cache.ts (TtlCache), vitest

---

## Pre-flight

Before starting, read:
- `docs/pre-flight-checklist.md`
- `docs/development-standards.md`
- Check `docs/duo-planning/` for conflicts

Create branch: `feat/sentiment-module`

---

### Task 1: Create client with CNN Fear & Greed fetcher

**Files:**
- Create: `src/modules/sentiment/client.ts`

**Step 1: Write the failing test**

Create `src/modules/sentiment/__tests__/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getFearAndGreed, getCryptoFearAndGreed } from "../client.js";

describe("getFearAndGreed", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns current score and sub-indicators", async () => {
    const mockResponse = {
      fear_and_greed: {
        score: 23,
        rating: "extreme fear",
        previous_close: 25,
        previous_1_week: 30,
        previous_1_month: 45,
        previous_1_year: 60,
      },
      market_momentum_sp500: { score: 20, rating: "extreme fear" },
      stock_price_strength: { score: 15, rating: "extreme fear" },
      stock_price_breadth: { score: 10, rating: "extreme fear" },
      put_call_options: { score: 30, rating: "fear" },
      market_volatility_vix: { score: 25, rating: "fear" },
      junk_bond_demand: { score: 35, rating: "fear" },
      safe_haven_demand: { score: 28, rating: "fear" },
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await getFearAndGreed();
    expect(result.score).toBe(23);
    expect(result.rating).toBe("extreme fear");
    expect(result.previousClose).toBe(25);
    expect(result.indicators).toHaveLength(7);
    expect(result.indicators[0]).toHaveProperty("name");
    expect(result.indicators[0]).toHaveProperty("score");
    expect(result.indicators[0]).toHaveProperty("rating");
  });

  it("sends browser User-Agent and CNN Referer headers", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        fear_and_greed: { score: 50, rating: "neutral", previous_close: 48, previous_1_week: 45, previous_1_month: 40, previous_1_year: 55 },
        market_momentum_sp500: { score: 50, rating: "neutral" },
        stock_price_strength: { score: 50, rating: "neutral" },
        stock_price_breadth: { score: 50, rating: "neutral" },
        put_call_options: { score: 50, rating: "neutral" },
        market_volatility_vix: { score: 50, rating: "neutral" },
        junk_bond_demand: { score: 50, rating: "neutral" },
        safe_haven_demand: { score: 50, rating: "neutral" },
      }),
    });

    await getFearAndGreed();

    const callArgs = (fetch as any).mock.calls[0];
    const headers = callArgs[1].headers;
    expect(headers["User-Agent"]).toContain("Mozilla/5.0");
    expect(headers["Referer"]).toBe("https://www.cnn.com/markets/fear-and-greed");
  });

  it("caches results", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        fear_and_greed: { score: 50, rating: "neutral", previous_close: 48, previous_1_week: 45, previous_1_month: 40, previous_1_year: 55 },
        market_momentum_sp500: { score: 50, rating: "neutral" },
        stock_price_strength: { score: 50, rating: "neutral" },
        stock_price_breadth: { score: 50, rating: "neutral" },
        put_call_options: { score: 50, rating: "neutral" },
        market_volatility_vix: { score: 50, rating: "neutral" },
        junk_bond_demand: { score: 50, rating: "neutral" },
        safe_haven_demand: { score: 50, rating: "neutral" },
      }),
    });

    await getFearAndGreed();
    await getFearAndGreed();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/sentiment/__tests__/client.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/modules/sentiment/client.ts`:

```typescript
import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";

const CNN_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
const ALTERNATIVE_ME_URL = "https://api.alternative.me/fng/";

const CNN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": "https://www.cnn.com/markets/fear-and-greed",
};

// CNN data updates once daily — cache for 1 hour
const CACHE_TTL = 60 * 60 * 1000;
const cache = new TtlCache<unknown>(CACHE_TTL);

export interface FearGreedIndicator {
  name: string;
  score: number;
  rating: string;
}

export interface FearGreedResult {
  score: number;
  rating: string;
  previousClose: number;
  previous1Week: number;
  previous1Month: number;
  previous1Year: number;
  indicators: FearGreedIndicator[];
}

interface CnnIndicatorData {
  score: number;
  rating: string;
}

interface CnnResponse {
  fear_and_greed: {
    score: number;
    rating: string;
    previous_close: number;
    previous_1_week: number;
    previous_1_month: number;
    previous_1_year: number;
  };
  market_momentum_sp500: CnnIndicatorData;
  stock_price_strength: CnnIndicatorData;
  stock_price_breadth: CnnIndicatorData;
  put_call_options: CnnIndicatorData;
  market_volatility_vix: CnnIndicatorData;
  junk_bond_demand: CnnIndicatorData;
  safe_haven_demand: CnnIndicatorData;
}

const INDICATOR_LABELS: Record<string, string> = {
  market_momentum_sp500: "S&P 500 Momentum",
  stock_price_strength: "Stock Price Strength (52w highs vs lows)",
  stock_price_breadth: "Stock Price Breadth (McClellan Volume)",
  put_call_options: "Put/Call Ratio",
  market_volatility_vix: "Market Volatility (VIX)",
  junk_bond_demand: "Junk Bond Demand (yield spread)",
  safe_haven_demand: "Safe Haven Demand (stocks vs bonds)",
};

export async function getFearAndGreed(): Promise<FearGreedResult> {
  const cacheKey = "fear-greed";
  const cached = cache.get(cacheKey);
  if (cached) return cached as FearGreedResult;

  const data = await httpGet<CnnResponse>(CNN_URL, {
    headers: CNN_HEADERS,
  });

  const indicatorKeys = Object.keys(INDICATOR_LABELS) as Array<keyof typeof INDICATOR_LABELS>;
  const indicators: FearGreedIndicator[] = indicatorKeys.map((key) => ({
    name: INDICATOR_LABELS[key],
    score: Math.round((data as any)[key]?.score ?? 0),
    rating: (data as any)[key]?.rating ?? "unknown",
  }));

  const result: FearGreedResult = {
    score: Math.round(data.fear_and_greed.score),
    rating: data.fear_and_greed.rating,
    previousClose: Math.round(data.fear_and_greed.previous_close),
    previous1Week: Math.round(data.fear_and_greed.previous_1_week),
    previous1Month: Math.round(data.fear_and_greed.previous_1_month),
    previous1Year: Math.round(data.fear_and_greed.previous_1_year),
    indicators,
  };

  cache.set(cacheKey, result);
  return result;
}

export interface CryptoFearGreedResult {
  score: number;
  rating: string;
  timestamp: string;
}

export async function getCryptoFearAndGreed(): Promise<CryptoFearGreedResult> {
  const cacheKey = "crypto-fear-greed";
  const cached = cache.get(cacheKey);
  if (cached) return cached as CryptoFearGreedResult;

  const data = await httpGet<{
    data: Array<{
      value: string;
      value_classification: string;
      timestamp: string;
    }>;
  }>(ALTERNATIVE_ME_URL);

  const entry = data.data[0];
  const result: CryptoFearGreedResult = {
    score: parseInt(entry.value, 10),
    rating: entry.value_classification.toLowerCase(),
    timestamp: new Date(parseInt(entry.timestamp, 10) * 1000).toISOString(),
  };

  cache.set(cacheKey, result);
  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/sentiment/__tests__/client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/sentiment/
git commit -m "feat(sentiment): add client with CNN Fear & Greed and crypto fetchers"
```

---

### Task 2: Add crypto Fear & Greed tests

**Files:**
- Modify: `src/modules/sentiment/__tests__/client.test.ts`

**Step 1: Add tests for getCryptoFearAndGreed**

Append to the existing test file:

```typescript
describe("getCryptoFearAndGreed", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns current crypto sentiment score", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{
          value: "12",
          value_classification: "Extreme Fear",
          timestamp: "1774051200",
        }],
      }),
    });

    const result = await getCryptoFearAndGreed();
    expect(result.score).toBe(12);
    expect(result.rating).toBe("extreme fear");
    expect(result.timestamp).toContain("2026-");
  });

  it("caches results", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ value: "50", value_classification: "Neutral", timestamp: "1774051200" }],
      }),
    });

    await getCryptoFearAndGreed();
    await getCryptoFearAndGreed();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/modules/sentiment/__tests__/client.test.ts`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/modules/sentiment/__tests__/client.test.ts
git commit -m "test(sentiment): add crypto fear & greed client tests"
```

---

### Task 3: Create module index with tool definitions

**Files:**
- Create: `src/modules/sentiment/index.ts`

**Step 1: Write the module factory**

```typescript
import { z } from "zod";
import type { ModuleDefinition } from "../../shared/types.js";
import { successResult } from "../../shared/types.js";
import { getFearAndGreed, getCryptoFearAndGreed } from "./client.js";
import { withMetadata } from "../../shared/utils.js";

const fearGreedTool = {
  name: "sentiment_fear_greed",
  description:
    "Get the CNN Fear & Greed Index for the US stock market. " +
    "Returns a composite score (0-100) with rating (extreme fear/fear/neutral/greed/extreme greed) " +
    "and 7 sub-indicators: S&P 500 momentum, stock price strength (52w highs vs lows), " +
    "stock price breadth (McClellan), put/call ratio, VIX, junk bond demand, safe haven demand. " +
    "Also includes previous close, 1-week, 1-month, and 1-year scores for trend context. " +
    "Use this to gauge overall market sentiment before analyzing individual stocks.",
  inputSchema: z.object({}),
  handler: withMetadata(async () => {
    const result = await getFearAndGreed();
    return successResult(JSON.stringify(result, null, 2));
  }, { source: "cnn-fear-greed", dataDelay: "end of day" }),
};

const cryptoFearGreedTool = {
  name: "sentiment_crypto_fear_greed",
  description:
    "Get the Crypto Fear & Greed Index from Alternative.me. " +
    "Returns a score (0-100) with rating (extreme fear/fear/neutral/greed/extreme greed). " +
    "Based on Bitcoin volatility, market volume, social media, surveys, dominance, and trends. " +
    "Use this alongside coingecko tools for crypto market context.",
  inputSchema: z.object({}),
  handler: withMetadata(async () => {
    const result = await getCryptoFearAndGreed();
    return successResult(JSON.stringify(result, null, 2));
  }, { source: "alternative-me", dataDelay: "daily" }),
};

export function createSentimentModule(): ModuleDefinition {
  return {
    name: "sentiment",
    description: "Market sentiment — CNN Fear & Greed Index and crypto sentiment",
    requiredEnvVars: [],
    tools: [fearGreedTool, cryptoFearGreedTool],
  };
}
```

**Step 2: Run lint**

Run: `npm run lint`
Expected: PASS

**Step 3: Commit**

```bash
git add src/modules/sentiment/index.ts
git commit -m "feat(sentiment): add module index with 2 tool definitions"
```

---

### Task 4: Wire module into server

**Files:**
- Modify: `src/index.ts`

**Step 1: Add import and registration**

Add import at the top with other module imports:
```typescript
import { createSentimentModule } from "./modules/sentiment/index.js";
```

Add to `buildModules()` array (with the other no-key modules):
```typescript
createSentimentModule(),
```

Update `MODULE_CATALOG` array — add entry:
```typescript
{ name: "sentiment", envVar: null, toolCount: 2, factory: () => createSentimentModule() },
```

Update `MODULES` line in `printHelp()`:
```
  sentiment          2 tools  Market & crypto Fear & Greed sentiment   (no key)
```

Update total tool count in help text from `47` to `49`.

**Step 2: Update integration test**

Modify `src/__tests__/integration.test.ts`:
- Add `import { createSentimentModule } from "../modules/sentiment/index.js";`
- Add `createSentimentModule()` to `buildAllModules()` array
- Update expected free module list to include `"sentiment"`
- Update free module tool count from `29` to `31` (29 + 2)
- Update total tool count from `47` to `49`
- Update unique tool name count from `47` to `49`

**Step 3: Run all quality gates**

```bash
npm run lint
npm test
npm run build
```

Expected: ALL PASS

**Step 4: Commit**

```bash
git add src/index.ts src/__tests__/integration.test.ts
git commit -m "feat(sentiment): wire module into server — 49 tools total"
```

---

### Task 5: Update documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/development-standards.md`

**Step 1: Update CLAUDE.md**

- Update version if needed
- Update module count from 9 to 10
- Update tool count from 47 to 49
- Add `sentiment/` to project structure tree
- Add `sentiment` row to Module Status table:
  ```
  | sentiment | (none) | Always |
  ```

**Step 2: Update development-standards.md**

- Update any module/tool counts referenced

**Step 3: Run quality gates**

```bash
npm run lint
npm test
npm run build
```

**Step 4: Commit**

```bash
git add CLAUDE.md docs/development-standards.md
git commit -m "docs: update for sentiment module — 10 modules, 49 tools"
```

---

### Task 6: Create PR

```bash
git push -u origin feat/sentiment-module
gh pr create --title "feat: add sentiment module with Fear & Greed tools (#102)" \
  --body "## Summary
- New `sentiment` module with 2 tools (no API key required)
- \`sentiment_fear_greed\` — CNN Fear & Greed Index (composite score + 7 sub-indicators)
- \`sentiment_crypto_fear_greed\` — Crypto Fear & Greed from Alternative.me

## Data sources
- CNN: \`production.dataviz.cnn.io/index/fearandgreed/graphdata\` (requires browser headers)
- Alternative.me: \`api.alternative.me/fng/\` (public API)

## Test plan
- [ ] \`npm run lint\` passes
- [ ] \`npm test\` passes
- [ ] \`npm run build\` passes
- [ ] Client tests cover: data parsing, header injection, caching
- [ ] Integration test updated for 10 modules / 49 tools

Closes #102"
```

---

## Summary

| Task | What | Files | Est. |
|------|------|-------|------|
| 1 | Client + CNN tests | `client.ts`, `client.test.ts` | 5 min |
| 2 | Crypto client tests | `client.test.ts` | 3 min |
| 3 | Module index | `index.ts` | 3 min |
| 4 | Wire into server | `index.ts`, `integration.test.ts` | 5 min |
| 5 | Update docs | `CLAUDE.md`, `development-standards.md` | 3 min |
| 6 | Create PR | — | 2 min |

**Total new tools:** 2 (`sentiment_fear_greed`, `sentiment_crypto_fear_greed`)
**New module count:** 10 (was 9)
**New tool count:** 49 (was 47)
**API key required:** None — always auto-enabled
