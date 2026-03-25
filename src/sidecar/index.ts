#!/usr/bin/env node

import { createServer } from "./server.js";

function parsePort(args: string[]): number {
  const idx = args.indexOf("--port");
  if (idx !== -1 && args[idx + 1]) {
    const port = Number(args[idx + 1]);
    if (!Number.isNaN(port) && port > 0 && port < 65536) return port;
  }
  return 3100;
}

function main(): void {
  const args = process.argv.slice(2);
  const port = parsePort(args);
  const finnhubApiKey = process.env.FINNHUB_API_KEY;
  const fredApiKey = process.env.FRED_API_KEY;
  const alphaVantageApiKey = process.env.ALPHA_VANTAGE_API_KEY;

  const server = createServer({ port, finnhubApiKey, fredApiKey, alphaVantageApiKey });

  const enabled: string[] = [];
  const disabled: string[] = [];

  if (finnhubApiKey) enabled.push("finnhub"); else disabled.push("finnhub (FINNHUB_API_KEY not set)");
  if (fredApiKey) enabled.push("fred"); else disabled.push("fred (FRED_API_KEY not set)");
  if (alphaVantageApiKey) enabled.push("alpha-vantage"); else disabled.push("alpha-vantage (ALPHA_VANTAGE_API_KEY not set)");

  console.error(`[stock-scanner-sidecar] listening on port ${port}`);
  console.error(`  Always-on: tradingview, tradingview-crypto, sec-edgar, options, options-cboe, sentiment, coingecko`);
  if (enabled.length) console.error(`  Enabled:   ${enabled.join(", ")}`);
  if (disabled.length) console.error(`  Disabled:  ${disabled.join(", ")}`);

  const shutdown = (): void => {
    console.error("[stock-scanner-sidecar] shutting down...");
    server.close(() => process.exit(0));
    // Force exit after 5s if connections linger
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();
