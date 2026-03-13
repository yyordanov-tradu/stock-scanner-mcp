import { httpGet } from "../../shared/http.js";
import { SEC_USER_AGENT } from "../../shared/types.js";

const TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json";

interface SecTickerMap {
  [key: string]: {
    cik_str: number;
    ticker: string;
    title: string;
  };
}

let tickerToCik: Map<string, string> | null = null;
let initPromise: Promise<void> | null = null;

async function initTickerMap() {
  if (tickerToCik) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const data = await httpGet<SecTickerMap>(TICKER_MAP_URL, {
        headers: { "User-Agent": SEC_USER_AGENT },
      });

      tickerToCik = new Map();
      for (const entry of Object.values(data)) {
        // SEC CIKs in URLs must be 10 digits, zero-padded
        const cik = String(entry.cik_str).padStart(10, "0");
        tickerToCik.set(entry.ticker.toUpperCase(), cik);
      }
    } catch (err) {
      initPromise = null; // Allow retry on failure
      throw err;
    }
  })();

  return initPromise;
}

export async function getCikForTicker(ticker: string): Promise<string | null> {
  await initTickerMap();
  return tickerToCik?.get(ticker.toUpperCase()) ?? null;
}

/** @internal */
export function __resetForTests() {
  tickerToCik = null;
  initPromise = null;
}
