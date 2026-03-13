import { httpGet } from "../../shared/http.js";

const TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json";
const USER_AGENT = "StockScanner contact@example.com";

interface SecTickerMap {
  [key: string]: {
    cik_str: number;
    ticker: string;
    title: string;
  };
}

let tickerToCik: Map<string, string> | null = null;

async function initTickerMap() {
  if (tickerToCik) return;

  const data = await httpGet<SecTickerMap>(TICKER_MAP_URL, {
    headers: { "User-Agent": USER_AGENT },
  });

  tickerToCik = new Map();
  for (const entry of Object.values(data)) {
    // SEC CIKs in URLs must be 10 digits, zero-padded
    const cik = String(entry.cik_str).padStart(10, "0");
    tickerToCik.set(entry.ticker.toUpperCase(), cik);
  }
}

export async function getCikForTicker(ticker: string): Promise<string | null> {
  await initTickerMap();
  return tickerToCik?.get(ticker.toUpperCase()) ?? null;
}
