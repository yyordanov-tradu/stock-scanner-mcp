# Task 9: TradingView Crypto Scanner Module

**Files:**
- Create: `src/modules/tradingview-crypto/columns.ts`
- Create: `src/modules/tradingview-crypto/scanner.ts`
- Create: `src/modules/tradingview-crypto/index.ts`
- Test: `src/modules/tradingview-crypto/__tests__/scanner.test.ts`

---

**Step 1: Write the test**

Create `src/modules/tradingview-crypto/__tests__/scanner.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scanCrypto } from "../scanner.js";
import { CRYPTO_COLUMNS, CRYPTO_TIMEFRAMES } from "../columns.js";

describe("CRYPTO_COLUMNS", () => {
  it("has 24 column IDs", () => {
    expect(CRYPTO_COLUMNS).toHaveLength(24);
  });

  it("includes key crypto indicators", () => {
    expect(CRYPTO_COLUMNS).toContain("close");
    expect(CRYPTO_COLUMNS).toContain("24h_vol");
    expect(CRYPTO_COLUMNS).toContain("market_cap_calc");
    expect(CRYPTO_COLUMNS).toContain("RSI");
  });
});

describe("scanCrypto", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST to crypto scanner API and maps response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { s: "BINANCE:BTCUSDT", d: [42000, 2.5, 1050, 1500000000, 800e9, 0.5, 0.6, 0.4, 55, 100, 80, 60, 58, 41000, 43000, 41500, 41800, 40000, 41500, 41800, 40000, 2000000000, "Bitcoin / TetherUS", "BTCUSDT"] },
        ],
      }),
    });

    const rows = await scanCrypto({ tickers: ["BINANCE:BTCUSDT"] });

    expect(fetch).toHaveBeenCalledWith(
      "https://scanner.tradingview.com/crypto/scan",
      expect.objectContaining({ method: "POST" }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].symbol).toBe("BINANCE:BTCUSDT");
  });

  it("applies timeframe suffix for 1h", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await scanCrypto({ timeframe: "1h", columns: ["close", "RSI", "name"] });

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.columns).toContain("close|60");
    expect(callBody.columns).toContain("RSI|60");
    expect(callBody.columns).toContain("name"); // no suffix for metadata
  });

  it("applies filters when no tickers", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await scanCrypto({ filters: [{ left: "change", operation: "greater", right: 5 }] });

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.filter2.operands[0].left).toBe("change");
  });
});

describe("createTradingviewCryptoModule", () => {
  it("returns module with 4 tools and no required env vars", async () => {
    const { createTradingviewCryptoModule } = await import("../index.js");
    const mod = createTradingviewCryptoModule();
    expect(mod.name).toBe("tradingview-crypto");
    expect(mod.requiredEnvVars).toEqual([]);
    expect(mod.tools).toHaveLength(4);
    expect(mod.tools.map((t) => t.name)).toEqual([
      "crypto_scan", "crypto_quote", "crypto_technicals", "crypto_top_gainers",
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/tradingview-crypto/__tests__/scanner.test.ts`
Expected: FAIL -- module not found

**Step 3: Write the code**

Create `src/modules/tradingview-crypto/columns.ts`:

```typescript
export const CRYPTO_COLUMNS: string[] = [
  "close",
  "change",
  "change_abs",
  "volume",
  "market_cap_calc",
  "Recommend.All",
  "Recommend.MA",
  "Recommend.Other",
  "RSI",
  "MACD.macd",
  "MACD.signal",
  "Stoch.K",
  "Stoch.D",
  "BB.lower",
  "BB.upper",
  "EMA20",
  "EMA50",
  "EMA200",
  "SMA20",
  "SMA50",
  "SMA200",
  "24h_vol",
  "description",
  "name",
];

export const CRYPTO_TIMEFRAMES: Record<string, string> = {
  "1m": "|1",
  "5m": "|5",
  "15m": "|15",
  "1h": "|60",
  "4h": "|240",
  "1W": "|1W",
  "1M": "|1M",
  "1d": "",
};
```

Create `src/modules/tradingview-crypto/scanner.ts`:

```typescript
import { httpPost } from "../../shared/http.js";
import { CRYPTO_COLUMNS, CRYPTO_TIMEFRAMES } from "./columns.js";

export interface CryptoScanRequest {
  tickers?: string[];
  filters?: Array<{ left: string; operation: string; right: number | string }>;
  columns?: string[];
  timeframe?: string;
  limit?: number;
}

export interface CryptoScanRow {
  symbol: string;
  data: Record<string, number | string | null>;
}

const API_URL = "https://scanner.tradingview.com/crypto/scan";

function applyTimeframeSuffix(columns: string[], timeframe: string): string[] {
  const suffix = CRYPTO_TIMEFRAMES[timeframe] ?? "";
  if (!suffix) return columns;
  const metaCols = ["name", "description", "24h_vol"];
  return columns.map((col) => metaCols.includes(col) ? col : col + suffix);
}

export async function scanCrypto(request: CryptoScanRequest): Promise<CryptoScanRow[]> {
  const rawColumns = request.columns ?? CRYPTO_COLUMNS;
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
  }

  const response = await httpPost<{
    data: Array<{ s: string; d: Array<number | string | null> }>;
  }>(API_URL, body);

  return response.data.map((row) => {
    const data: Record<string, number | string | null> = {};
    rawColumns.forEach((col, i) => {
      data[col] = row.d[i] ?? null;
    });
    return { symbol: row.s, data };
  });
}
```

Create `src/modules/tradingview-crypto/index.ts`:

```typescript
import { z } from "zod";
import type { ModuleDefinition, ToolDefinition } from "../../shared/types.js";
import { successResult, errorResult } from "../../shared/types.js";
import { scanCrypto } from "./scanner.js";

const scanTool: ToolDefinition = {
  name: "crypto_scan",
  description:
    "Scan cryptocurrency pairs using TradingView filters. Returns price, volume, and technical indicators.",
  inputSchema: {
    filters: z
      .array(
        z.object({
          left: z.string().describe("Column name (e.g. 'close', 'RSI', 'volume')"),
          operation: z.string().describe("Comparison: 'greater', 'less', 'in_range', 'equal'"),
          right: z.union([z.number(), z.string()]).describe("Value to compare against"),
        }),
      )
      .optional()
      .describe("Filter conditions combined with AND"),
    columns: z.array(z.string()).optional().describe("Columns to return (default: all 24)"),
    timeframe: z
      .string()
      .optional()
      .describe("Timeframe: '1m','5m','15m','1h','4h','1d','1W','1M'. Default: '1d'"),
    limit: z.number().optional().describe("Max results (default: 50, max: 200)"),
  },
  handler: async (params) => {
    try {
      const rows = await scanCrypto({
        filters: params.filters as
          | Array<{ left: string; operation: string; right: number | string }>
          | undefined,
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
  name: "crypto_quote",
  description:
    "Get real-time quotes for specific crypto pairs. Use exchange:pair format (e.g. BINANCE:BTCUSDT).",
  inputSchema: {
    symbols: z
      .array(z.string())
      .describe("Crypto pair symbols (e.g. ['BINANCE:BTCUSDT', 'BINANCE:ETHUSDT'])"),
  },
  handler: async (params) => {
    try {
      const rows = await scanCrypto({
        tickers: params.symbols as string[],
        columns: [
          "close",
          "change",
          "change_abs",
          "volume",
          "24h_vol",
          "market_cap_calc",
          "description",
        ],
      });
      return successResult(JSON.stringify(rows, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const technicalsTool: ToolDefinition = {
  name: "crypto_technicals",
  description:
    "Get technical analysis for crypto pairs. Includes RSI, MACD, moving averages, and recommendation.",
  inputSchema: {
    symbols: z.array(z.string()).describe("Crypto symbols (e.g. ['BINANCE:BTCUSDT'])"),
    timeframe: z.string().optional().describe("Timeframe. Default: '1d'"),
  },
  handler: async (params) => {
    try {
      const rows = await scanCrypto({
        tickers: params.symbols as string[],
        timeframe: params.timeframe as string | undefined,
        columns: [
          "Recommend.All",
          "Recommend.MA",
          "Recommend.Other",
          "RSI",
          "MACD.macd",
          "MACD.signal",
          "Stoch.K",
          "Stoch.D",
          "EMA20",
          "EMA50",
          "EMA200",
          "SMA20",
          "SMA50",
          "SMA200",
          "BB.lower",
          "BB.upper",
          "close",
        ],
      });
      return successResult(JSON.stringify(rows, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

const topGainersTool: ToolDefinition = {
  name: "crypto_top_gainers",
  description: "Get top gaining cryptocurrency pairs by percentage change.",
  inputSchema: {
    limit: z.number().optional().describe("Number of results (default: 20, max: 50)"),
  },
  handler: async (params) => {
    try {
      const rows = await scanCrypto({
        filters: [{ left: "change", operation: "greater", right: 0 }],
        columns: [
          "close",
          "change",
          "change_abs",
          "volume",
          "24h_vol",
          "market_cap_calc",
          "description",
        ],
        limit: Math.min((params.limit as number) ?? 20, 50),
      });
      return successResult(JSON.stringify(rows, null, 2));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
};

export function createTradingviewCryptoModule(): ModuleDefinition {
  return {
    name: "tradingview-crypto",
    description:
      "TradingView crypto scanner -- real-time quotes, technical analysis, and screening for cryptocurrency pairs",
    requiredEnvVars: [],
    tools: [scanTool, quoteTool, technicalsTool, topGainersTool],
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/tradingview-crypto/__tests__/scanner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/tradingview-crypto/columns.ts src/modules/tradingview-crypto/scanner.ts src/modules/tradingview-crypto/index.ts src/modules/tradingview-crypto/__tests__/scanner.test.ts
git commit -m "feat: add TradingView crypto scanner module with 4 tools"
```
