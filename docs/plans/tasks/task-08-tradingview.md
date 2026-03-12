# Task 8: TradingView Stock Scanner Module

**Files:**
- Create: `src/modules/tradingview/columns.ts`
- Create: `src/modules/tradingview/scanner.ts`
- Create: `src/modules/tradingview/index.ts`
- Test: `src/modules/tradingview/__tests__/scanner.test.ts`

---

**Step 1: Write the test**

Create `src/modules/tradingview/__tests__/scanner.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scanStocks } from "../scanner.js";
import { STOCK_COLUMNS, STOCK_TIMEFRAMES } from "../columns.js";

describe("STOCK_COLUMNS", () => {
  it("has 62 column IDs", () => {
    expect(STOCK_COLUMNS).toHaveLength(62);
  });

  it("includes key indicators", () => {
    expect(STOCK_COLUMNS).toContain("close");
    expect(STOCK_COLUMNS).toContain("RSI");
    expect(STOCK_COLUMNS).toContain("MACD.macd");
    expect(STOCK_COLUMNS).toContain("EMA200");
    expect(STOCK_COLUMNS).toContain("volume");
  });
});

describe("STOCK_TIMEFRAMES", () => {
  it("maps daily to empty suffix", () => {
    expect(STOCK_TIMEFRAMES["1d"]).toBe("");
  });

  it("maps 1h to |60", () => {
    expect(STOCK_TIMEFRAMES["1h"]).toBe("|60");
  });
});

describe("scanStocks", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST to TradingView API and maps response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { s: "NASDAQ:AAPL", d: [150.5, 1.2, 1.8, 50000000, 2.5e12, 28.5, 6.35, 150000, "Technology", "Apple Inc", "AAPL", "stock", "common", "streaming", "NASDAQ", "USD", 100, 1, false, 0, 0.6, 0.7, 0.5, 55, 52, 60, 58, 59, 57, 120, 118, 22, 25, 18, 24, 19, 5, 4, 3, 1.5, 1.2, 2.1, 1.8, 148, 153, 140, 142, 145, 148, 152, 155, 160, 149, 150, 151, 150, 149, 148, 149, 150, 151, 150, 149, 148] },
        ],
      }),
    });

    const rows = await scanStocks({ tickers: ["NASDAQ:AAPL"], columns: ["close", "change", "volume"] });

    expect(fetch).toHaveBeenCalledWith(
      "https://scanner.tradingview.com/america/scan",
      expect.objectContaining({ method: "POST" }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].symbol).toBe("NASDAQ:AAPL");
    expect(rows[0].data.close).toBe(150.5);
  });

  it("applies exchange filter when no tickers specified", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await scanStocks({ exchange: "NYSE", filters: [{ left: "close", operation: "greater", right: 100 }] });

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.markets).toEqual(["NYSE"]);
    expect(callBody.filter2.operands).toHaveLength(1);
    expect(callBody.filter2.operands[0].left).toBe("close");
  });

  it("respects limit parameter", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await scanStocks({ limit: 10 });

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.range).toEqual([0, 10]);
  });

  it("applies timeframe suffix for non-daily timeframes", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await scanStocks({ timeframe: "1h", columns: ["close", "RSI", "name"] });

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.columns).toContain("close|60");
    expect(callBody.columns).toContain("RSI|60");
    expect(callBody.columns).toContain("name"); // metadata columns should NOT get suffix
  });
});

describe("createTradingviewModule", () => {
  it("returns module with 5 tools and no required env vars", async () => {
    const { createTradingviewModule } = await import("../index.js");
    const mod = createTradingviewModule();
    expect(mod.name).toBe("tradingview");
    expect(mod.requiredEnvVars).toEqual([]);
    expect(mod.tools).toHaveLength(5);
    expect(mod.tools.map((t) => t.name)).toEqual([
      "tradingview_scan",
      "tradingview_quote",
      "tradingview_technicals",
      "tradingview_top_gainers",
      "tradingview_top_volume",
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/tradingview/__tests__/scanner.test.ts`
Expected: FAIL -- module not found

**Step 3: Write the code**

Create `src/modules/tradingview/columns.ts`:

```typescript
export const STOCK_COLUMNS: string[] = [
  "close",
  "change",
  "change_abs",
  "volume",
  "market_cap_basic",
  "price_earnings_ttm",
  "earnings_per_share_basic_ttm",
  "number_of_employees",
  "sector",
  "description",
  "name",
  "type",
  "subtype",
  "update_mode",
  "exchange",
  "currency_code",
  "pricescale",
  "minmov",
  "fractional",
  "minmove2",
  "Recommend.All",
  "Recommend.MA",
  "Recommend.Other",
  "RSI",
  "RSI[1]",
  "Stoch.K",
  "Stoch.D",
  "Stoch.K[1]",
  "Stoch.D[1]",
  "CCI20",
  "CCI20[1]",
  "ADX",
  "ADX+DI",
  "ADX-DI",
  "ADX+DI[1]",
  "ADX-DI[1]",
  "AO",
  "AO[1]",
  "AO[2]",
  "Mom",
  "Mom[1]",
  "MACD.macd",
  "MACD.signal",
  "BB.lower",
  "BB.upper",
  "Pivot.M.Classic.S3",
  "Pivot.M.Classic.S2",
  "Pivot.M.Classic.S1",
  "Pivot.M.Classic.Middle",
  "Pivot.M.Classic.R1",
  "Pivot.M.Classic.R2",
  "Pivot.M.Classic.R3",
  "EMA5",
  "EMA10",
  "EMA20",
  "EMA30",
  "EMA50",
  "EMA100",
  "EMA200",
  "SMA5",
  "SMA10",
  "SMA20",
  "SMA30",
  "SMA50",
  "SMA100",
  "SMA200",
];

export const STOCK_TIMEFRAMES: Record<string, string> = {
  "1m": "|1",
  "5m": "|5",
  "15m": "|15",
  "1h": "|60",
  "4h": "|240",
  "1W": "|1W",
  "1M": "|1M",
  "1d": "",  // daily is default, no suffix
};
```

Create `src/modules/tradingview/scanner.ts`:

```typescript
import { httpPost } from "../../shared/http.js";
import { STOCK_COLUMNS, STOCK_TIMEFRAMES } from "./columns.js";

export interface ScanFilter {
  left: string;
  operation: string;
  right: number | string;
}

export interface ScanRequest {
  tickers?: string[];
  exchange?: string;
  filters?: ScanFilter[];
  columns?: string[];
  timeframe?: string;
  limit?: number;
}

export interface ScanRow {
  symbol: string;
  data: Record<string, number | string | null>;
}

const API_URL = "https://scanner.tradingview.com/america/scan";

function applyTimeframeSuffix(columns: string[], timeframe: string): string[] {
  const suffix = STOCK_TIMEFRAMES[timeframe] ?? "";
  if (!suffix) return columns;
  return columns.map((col) => {
    // Only technical indicators get timeframe suffix, not metadata
    const metaCols = ["name", "description", "type", "subtype", "exchange", "currency_code", "sector",
      "update_mode", "pricescale", "minmov", "fractional", "minmove2", "number_of_employees", "market_cap_basic"];
    return metaCols.includes(col) ? col : col + suffix;
  });
}

export async function scanStocks(request: ScanRequest): Promise<ScanRow[]> {
  const rawColumns = request.columns ?? STOCK_COLUMNS;
  const timeframe = request.timeframe ?? "1d";
  const columns = applyTimeframeSuffix(rawColumns, timeframe);

  const body: Record<string, unknown> = {
    columns,
    options: { lang: "en" },
    range: [0, request.limit ?? 50],
    sort: { sortBy: columns[0], sortOrder: "desc" },
  };

  if (request.tickers) {
    body.symbols = { tickers: request.tickers };
  } else {
    body.filter2 = {
      operator: "and",
      operands: (request.filters ?? []).map((f) => ({
        left: f.left,
        operation: f.operation,
        right: f.right,
      })),
    };
    if (request.exchange) {
      body.markets = [request.exchange];
    }
  }

  const response = await httpPost<{ data: Array<{ s: string; d: Array<number | string | null> }> }>(
    API_URL,
    body,
  );

  return response.data.map((row) => {
    const data: Record<string, number | string | null> = {};
    rawColumns.forEach((col, i) => {
      data[col] = row.d[i] ?? null;
    });
    return { symbol: row.s, data };
  });
}
```

Create `src/modules/tradingview/index.ts`:

```typescript
import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult, errorResult } from "../../shared/types.js";
import { scanStocks } from "./scanner.js";

const scanTool: ToolDefinition = {
  name: "tradingview_scan",
  description: "Scan stocks using TradingView filters. Supports filtering by any technical or fundamental indicator. Returns up to 50 results by default.",
  inputSchema: {
    exchange: z.string().optional().describe("Exchange to scan (e.g. 'NASDAQ', 'NYSE', 'AMEX'). Default: all."),
    filters: z.array(z.object({
      left: z.string().describe("Column name (e.g. 'close', 'RSI', 'volume')"),
      operation: z.string().describe("Comparison: 'greater', 'less', 'in_range', 'equal'"),
      right: z.union([z.number(), z.string()]).describe("Value to compare against"),
    })).optional().describe("Array of filter conditions combined with AND"),
    columns: z.array(z.string()).optional().describe("Columns to return (default: all 62 indicators)"),
    timeframe: z.string().optional().describe("Timeframe: '1m','5m','15m','1h','4h','1d','1W','1M'. Default: '1d'"),
    limit: z.number().optional().describe("Max results to return (default: 50, max: 200)"),
  },
  handler: async (params) => {
    try {
      const rows = await scanStocks({
        exchange: params.exchange as string | undefined,
        filters: params.filters as Array<{ left: string; operation: string; right: number | string }> | undefined,
        columns: params.columns as string[] | undefined,
        timeframe: params.timeframe as string | undefined,
        limit: Math.min((params.limit as number) ?? 50, 200),
      });
      return successResult(JSON.stringify(rows, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const quoteTool: ToolDefinition = {
  name: "tradingview_quote",
  description: "Get real-time quotes for specific stock symbols. Returns price, change, volume, and key metrics.",
  inputSchema: {
    symbols: z.array(z.string()).describe("Stock symbols with exchange prefix (e.g. ['NASDAQ:AAPL', 'NYSE:MSFT'])"),
  },
  handler: async (params) => {
    try {
      const symbols = params.symbols as string[];
      const rows = await scanStocks({
        tickers: symbols,
        columns: ["close", "change", "change_abs", "volume", "market_cap_basic", "price_earnings_ttm", "description"],
      });
      return successResult(JSON.stringify(rows, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const technicalsTool: ToolDefinition = {
  name: "tradingview_technicals",
  description: "Get technical analysis summary for stock symbols. Includes RSI, MACD, moving averages, and overall recommendation (buy/sell/neutral).",
  inputSchema: {
    symbols: z.array(z.string()).describe("Stock symbols with exchange prefix (e.g. ['NASDAQ:AAPL'])"),
    timeframe: z.string().optional().describe("Timeframe: '1m','5m','15m','1h','4h','1d','1W','1M'. Default: '1d'"),
  },
  handler: async (params) => {
    try {
      const symbols = params.symbols as string[];
      const rows = await scanStocks({
        tickers: symbols,
        timeframe: params.timeframe as string | undefined,
        columns: [
          "Recommend.All", "Recommend.MA", "Recommend.Other",
          "RSI", "MACD.macd", "MACD.signal",
          "Stoch.K", "Stoch.D", "CCI20", "ADX", "AO", "Mom",
          "EMA20", "EMA50", "EMA200", "SMA20", "SMA50", "SMA200",
          "BB.lower", "BB.upper", "close",
        ],
      });
      return successResult(JSON.stringify(rows, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const topGainersTool: ToolDefinition = {
  name: "tradingview_top_gainers",
  description: "Get top gaining stocks by percentage change. Filters to common stocks only.",
  inputSchema: {
    exchange: z.string().optional().describe("Exchange: 'NASDAQ', 'NYSE', 'AMEX'. Default: all."),
    limit: z.number().optional().describe("Number of results (default: 20, max: 50)"),
  },
  handler: async (params) => {
    try {
      const rows = await scanStocks({
        exchange: params.exchange as string | undefined,
        filters: [
          { left: "type", operation: "equal", right: "stock" },
          { left: "subtype", operation: "equal", right: "common" },
          { left: "change", operation: "greater", right: 0 },
        ],
        columns: ["close", "change", "change_abs", "volume", "market_cap_basic", "description"],
        limit: Math.min((params.limit as number) ?? 20, 50),
      });
      return successResult(JSON.stringify(rows, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const topVolumeTool: ToolDefinition = {
  name: "tradingview_top_volume",
  description: "Get stocks with highest trading volume. Filters to common stocks only.",
  inputSchema: {
    exchange: z.string().optional().describe("Exchange: 'NASDAQ', 'NYSE', 'AMEX'. Default: all."),
    limit: z.number().optional().describe("Number of results (default: 20, max: 50)"),
  },
  handler: async (params) => {
    try {
      const rows = await scanStocks({
        exchange: params.exchange as string | undefined,
        filters: [
          { left: "type", operation: "equal", right: "stock" },
          { left: "subtype", operation: "equal", right: "common" },
        ],
        columns: ["close", "change", "volume", "market_cap_basic", "description"],
        limit: Math.min((params.limit as number) ?? 20, 50),
      });
      return successResult(JSON.stringify(rows, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const volumeBreakoutTool: ToolDefinition = {
  name: "tradingview_volume_breakout",
  description: "Get stocks with unusual trading volume relative to their average volume. Useful for finding momentum and breakouts.",
  inputSchema: {
    exchange: z.string().optional().describe("Exchange: 'NASDAQ', 'NYSE', 'AMEX'. Default: all."),
    minVolume: z.number().optional().describe("Minimum current volume (default: 500k)"),
    limit: z.number().optional().describe("Number of results (default: 20, max: 50)"),
  },
  handler: async (params) => {
    try {
      const rows = await scanStocks({
        exchange: params.exchange as string | undefined,
        filters: [
          { left: "type", operation: "equal", right: "stock" },
          { left: "subtype", operation: "equal", right: "common" },
          { left: "volume", operation: "greater", right: (params.minVolume as number) ?? 500000 },
          // TradingView has a built-in column for volume relative to average
          { left: "relative_volume_10d_calc", operation: "greater", right: 1.5 },
        ],
        columns: ["close", "change", "volume", "relative_volume_10d_calc", "market_cap_basic", "description"],
        limit: Math.min((params.limit as number) ?? 20, 50),
      });
      return successResult(JSON.stringify(rows, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

export function createTradingviewModule(): ModuleDefinition {
  return {
    name: "tradingview",
    description: "TradingView stock scanner -- real-time quotes, technical analysis, and market screening for US stocks",
    requiredEnvVars: [],
    tools: [scanTool, quoteTool, technicalsTool, topGainersTool, topVolumeTool, volumeBreakoutTool],
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/tradingview/__tests__/scanner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/tradingview/columns.ts src/modules/tradingview/scanner.ts src/modules/tradingview/index.ts src/modules/tradingview/__tests__/scanner.test.ts
git commit -m "feat: add TradingView stock scanner module with 5 tools"
```
