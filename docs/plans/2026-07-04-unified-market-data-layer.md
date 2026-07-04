# Unified Market Data Layer (Smart Router) Implementation Plan

**Date:** 2026-07-04
**Status:** Draft for review
**Author:** Antigravity (AI Architect)

---

## 1. Executive Summary

Currently, `stock-scanner-mcp` couples tools to specific data providers (e.g., `tradingview_quote` vs `finnhub_quote`). The LLM must determine which data sources are active and write conditional fallback logic. 

This plan introduces a unified, provider-agnostic module (`unified-market`) that exports high-level tools (`market_get_quote`, `market_get_profile`, `market_get_technicals`). These tools use a smart router to select the best available data source dynamically, handling missing API keys or rate limits gracefully without interrupting the user or LLM.

---

## 2. Product Scope

### In Scope
- Add a new module `unified-market` with three core tools:
  - `market_get_quote`: Returns stock/crypto price, change, volume, and delay metadata.
  - `market_get_profile`: Returns general company metrics, exchange, description, and capitalization.
  - `market_get_technicals`: Returns common indicators (RSI, moving averages, etc.).
- Implement internal provider routing maps that order providers by preference:
  - For stock quotes: Finnhub (real-time, key) -> Alpha Vantage (real-time, key) -> TradingView/Yahoo (15-min delay, keyless).
  - For crypto quotes: TradingView Crypto (keyless) -> Coingecko (keyless).
- Standardize response schemas to be identical regardless of which backend provider resolves the query.
- Add full unit test coverage for routing, falling back on key failure, and schema normalization.
- Expose the unified endpoints in the REST sidecar server.

### Out of Scope
- Deprecating or removing existing provider-specific tools immediately (to maintain backward compatibility).
- Creating new third-party integrations (e.g., Bloomberg, Polygon.io) in this phase.

---

## 3. Tool Contracts & Normalization

The unified tools will return a consistent JSON payload, regardless of provider.

### A. `market_get_quote`
- **Input Schema:**
  ```typescript
  z.object({
    symbol: z.string().describe("Stock ticker or crypto pair (e.g., 'AAPL', 'BTCUSDT', 'NYSE:IBM')"),
  })
  ```
- **Unified Output Shape:**
  ```json
  {
    "symbol": "NASDAQ:AAPL",
    "price": 180.25,
    "change": 1.25,
    "changePercent": 0.70,
    "volume": 52000000,
    "dayHigh": 181.00,
    "dayLow": 179.50,
    "open": 179.80,
    "previousClose": 179.00,
    "resolvedProvider": "finnhub",
    "isRealTime": true,
    "dataDelay": "real-time"
  }
  ```

### B. `market_get_profile`
- **Input Schema:**
  ```typescript
  z.object({
    symbol: z.string().describe("Stock ticker (e.g., 'AAPL')"),
  })
  ```
- **Unified Output Shape:**
  ```json
  {
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "exchange": "NASDAQ",
    "industry": "Technology",
    "marketCap": 2950000000000,
    "sharesOutstanding": 15630000000,
    "website": "https://www.apple.com",
    "description": "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets...",
    "resolvedProvider": "finnhub"
  }
  ```

---

## 4. Technical Architecture & Routing Design

The router will load the config to check active modules and try client functions in sequence.

```typescript
// src/modules/unified-market/router.ts

import { getQuote as getFinnhubQuote } from "../finnhub/client.js";
import { getQuote as getAlphaVantageQuote } from "../alpha-vantage/client.js"; // if exists
import { scanStocks as getTradingviewQuote } from "../tradingview/scanner.js";
import { resolveTicker } from "../../shared/resolver.js";

export async function routeGetQuote(symbol: string, config: any): Promise<UnifiedQuote> {
  const resolved = resolveTicker(symbol);
  
  if (resolved.isCrypto) {
    // Route to coingecko or tradingview-crypto
    return routeCryptoQuote(resolved);
  }

  // 1. Try Finnhub if key is configured
  if (config.env.FINNHUB_API_KEY) {
    try {
      const q = await getFinnhubQuote(config.env.FINNHUB_API_KEY, resolved.ticker);
      return {
        symbol: resolved.full,
        price: q.c,
        change: q.d,
        changePercent: q.dp,
        volume: 0, // Finnhub quote doesn't return volume directly, or backfill
        dayHigh: q.h,
        dayLow: q.l,
        open: q.o,
        previousClose: q.pc,
        resolvedProvider: "finnhub",
        isRealTime: true,
        dataDelay: "real-time",
      };
    } catch (e) {
      console.warn("Finnhub quote routing failed, attempting fallback...", e);
    }
  }

  // 2. Try Alpha Vantage if key is configured
  // ... similar implementation

  // 3. Fall back to TradingView (keyless, 15-minute delay)
  const rows = await getTradingviewQuote({
    tickers: [resolved.full],
    columns: ["close", "change", "change_abs", "volume", "high", "low", "open", "value"] // standard quote cols
  });
  
  const row = rows[0];
  if (!row) {
    throw new Error(`Symbol ${symbol} not found across all available providers.`);
  }

  return {
    symbol: resolved.full,
    price: Number(row.data.close),
    change: Number(row.data.change_abs),
    changePercent: Number(row.data.change),
    volume: Number(row.data.volume),
    dayHigh: Number(row.data.high),
    dayLow: Number(row.data.low),
    open: Number(row.data.open),
    previousClose: Number(row.data.close) - Number(row.data.change_abs),
    resolvedProvider: "tradingview",
    isRealTime: false,
    dataDelay: "15min",
  };
}
```

---

## 5. File Changes

### New Files
- `src/modules/unified-market/index.ts` — Factory for `unified-market` tools.
- `src/modules/unified-market/client.ts` — Normalization routing code.
- `src/modules/unified-market/__tests__/client.test.ts` — Unit tests for the router and mappings.

### Modified Files
- `src/registry.ts` — Import and register `createUnifiedMarketModule` in the `MODULE_CATALOG`.
- `src/sidecar/routes.ts` — Add declarative paths for `/market/quote`, `/market/profile`, `/market/technicals`.
- `README.md` & `CLAUDE.md` — Register the new module and explain its usage.

---

## 6. Verification and Testing Plan

### Automated Unit Tests
- Test routing fallback: Stub out Finnhub to throw a rate limit error, verify the router successfully falls back to TradingView without bubbling the error up.
- Test normalizations: Assert that different payloads from Finnhub and TradingView yield identical property names and types in the return value.
- Run tests:
  ```bash
  npx vitest run src/modules/unified-market/
  ```

### Sidecar Verification
- Rebuild sidecar and generate updated OpenAPI schema:
  ```bash
  npm run build
  npm run generate-openapi
  npm run validate-structure
  ```
- Send standard GET requests to `/market/quote?symbol=AAPL` and verify JSON outputs.
