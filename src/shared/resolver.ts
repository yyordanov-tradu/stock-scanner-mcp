export interface ResolvedTicker {
  ticker: string; // The base ticker, e.g. "AAPL"
  exchange?: string; // The exchange, e.g. "NASDAQ"
  full: string; // The full string, e.g. "NASDAQ:AAPL"
  isCrypto: boolean;
}

/**
 * Normalizes a ticker string into its components.
 * Examples:
 *   "aapl" -> { ticker: "AAPL", exchange: "NASDAQ", full: "NASDAQ:AAPL", isCrypto: false }
 *   "NYSE:IBM" -> { ticker: "IBM", exchange: "NYSE", full: "NYSE:IBM", isCrypto: false }
 *   "BTC" -> { ticker: "BTC", isCrypto: true, full: "BTC" }
 */
export function resolveTicker(input: string, defaultExchange = "NASDAQ"): ResolvedTicker {
  const cleaned = input.trim().toUpperCase();
  
  // Check for exchange prefix
  if (cleaned.includes(":")) {
    const [ex, tick] = cleaned.split(":");
    return {
      ticker: tick,
      exchange: ex,
      full: cleaned,
      isCrypto: ex === "BINANCE" || ex === "COINBASE" || ex === "KRAKEN", // Simple heuristic
    };
  }

  // Heuristic for crypto (3-5 chars, common ones)
  const commonCrypto = new Set(["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "DOT"]);
  if (commonCrypto.has(cleaned)) {
    return {
      ticker: cleaned,
      full: cleaned,
      isCrypto: true,
    };
  }

  // Default to stock with default exchange
  return {
    ticker: cleaned,
    exchange: defaultExchange,
    full: `${defaultExchange}:${cleaned}`,
    isCrypto: false,
  };
}
