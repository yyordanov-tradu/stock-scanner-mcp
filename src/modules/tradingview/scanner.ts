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

const META_COLUMNS = new Set([
  "name", "description", "type", "subtype", "exchange", "currency_code",
  "sector", "update_mode", "pricescale", "minmov", "fractional",
  "minmove2", "number_of_employees", "market_cap_basic",
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
