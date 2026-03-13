import { httpPost } from "../../shared/http.js";
import { CRYPTO_COLUMNS, CRYPTO_TIMEFRAMES } from "./columns.js";

export interface CryptoScanRequest {
  tickers?: string[];
  filters?: Array<{ left: string; operation: string; right: number | string | number[] }>;
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
  const metaCols = ["name", "description"];
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
    if (request.filters && request.filters.length > 0) {
      body.filter = request.filters.map((f) => ({
        left: f.left,
        operation: f.operation,
        right: f.right,
      }));
    }
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
