import { httpPost } from "../../shared/http.js";
import { STOCK_COLUMNS, STOCK_TIMEFRAMES } from "./columns.js";

export interface ScanFilter {
  left: string;
  operation: string;
  right: number | string | number[];
}

export interface ScanRequest {
  tickers?: string[];
  exchange?: string;
  filters?: ScanFilter[];
  columns?: string[];
  timeframe?: string;
  limit?: number;
  sort?: { sortBy: string; sortOrder: "asc" | "desc" };
}

export interface ScanRow {
  symbol: string;
  data: Record<string, number | string | null>;
}

const API_URL = "https://scanner.tradingview.com/america/scan";

const META_COLUMNS = new Set([
  "name", "description", "type", "subtype", "exchange",
  "sector", "update_mode", "pricescale", "minmov", "fractional",
  "minmove2", "number_of_employees", "market_cap_basic",
  "earnings_release_date", "earnings_release_next_date",
  "dividend_yield_recent", "return_on_equity_fq", "total_revenue_fq",
  "net_income_fq", "total_assets_fq", "total_debt_fq",
]);

function applyTimeframeSuffix(columns: string[], timeframe: string): string[] {
  const suffix = STOCK_TIMEFRAMES[timeframe] ?? "";
  if (!suffix) return columns;
  return columns.map((col) => META_COLUMNS.has(col) ? col : col + suffix);
}

export async function scanStocks(request: ScanRequest): Promise<ScanRow[]> {
  const rawColumns = request.columns ?? STOCK_COLUMNS;
  const timeframe = request.timeframe ?? "1d";
  const columns = applyTimeframeSuffix(rawColumns, timeframe);

  const body: Record<string, unknown> = {
    columns,
    options: { lang: "en" },
    range: [0, request.limit ?? 50],
    sort: request.sort ?? { sortBy: columns[0], sortOrder: "desc" },
  };

  if (request.tickers) {
    body.symbols = { tickers: request.tickers };
  } else {
    if (request.filters && request.filters.length > 0) {
      body.filter = request.filters.map((f) => ({
        left: f.left,
        operation: f.operation,
        right: f.right,
      }));
    }
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
