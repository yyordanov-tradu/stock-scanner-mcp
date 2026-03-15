#!/usr/bin/env node
// Benchmark: Technical Analysis for NVDA cash-secured put
// Calls the MCP server's underlying functions directly

import { scanStocks } from "./dist/modules/tradingview/scanner.js";
import { fetchOptionChain } from "./dist/modules/options/client.js";
import { resolveTicker } from "./dist/shared/resolver.js";

const startTime = Date.now();

async function main() {
  const ticker = "NVDA";
  const fullTicker = resolveTicker(ticker).full;

  console.log("=== BENCHMARK: NVDA Technical Analysis ===");
  console.log(`Start time: ${new Date().toISOString()}`);
  console.log("");

  // 1. Quote
  console.log("--- 1. TRADINGVIEW QUOTE ---");
  try {
    const quote = await scanStocks({
      tickers: [fullTicker],
      columns: ["close", "change", "change_abs", "volume", "market_cap_basic", "name", "description"],
    });
    console.log(JSON.stringify(quote, null, 2));
  } catch (e) { console.error("Quote error:", e.message); }

  console.log("");

  // 2. Technicals
  console.log("--- 2. TRADINGVIEW TECHNICALS ---");
  try {
    const technicalCols = [
      "Recommend.All", "Recommend.MA", "Recommend.Other",
      "RSI", "Stoch.K", "Stoch.D", "CCI20", "ADX", "ADX+DI", "ADX-DI",
      "AO", "Mom", "MACD.macd", "MACD.signal", "BB.lower", "BB.upper",
      "EMA20", "EMA50", "EMA200", "SMA20", "SMA50", "SMA200",
      "Pivot.M.Classic.S1", "Pivot.M.Classic.Middle", "Pivot.M.Classic.R1",
    ];
    const techs = await scanStocks({
      tickers: [fullTicker],
      columns: technicalCols,
    });
    console.log(JSON.stringify(techs, null, 2));
  } catch (e) { console.error("Technicals error:", e.message); }

  console.log("");

  // 3. Scan for support levels (find stocks near NVDA price with key levels)
  console.log("--- 3. TRADINGVIEW SCAN (support/resistance) ---");
  try {
    const supportCols = [
      "close", "Pivot.M.Classic.S1", "Pivot.M.Classic.S2", "Pivot.M.Classic.S3",
      "Pivot.M.Classic.R1", "Pivot.M.Classic.R2", "Pivot.M.Classic.R3",
      "Pivot.M.Classic.Middle",
      "BB.lower", "BB.upper",
      "low", "high", "price_52_week_low", "price_52_week_high",
      "SMA20", "SMA50", "SMA200",
    ];
    const support = await scanStocks({
      tickers: [fullTicker],
      columns: supportCols,
    });
    console.log(JSON.stringify(support, null, 2));
  } catch (e) { console.error("Support scan error:", e.message); }

  console.log("");

  // 4. Options expirations
  console.log("--- 4. OPTIONS EXPIRATIONS ---");
  let expirations = [];
  let underlyingPrice = null;
  try {
    const chain = await fetchOptionChain(ticker);
    underlyingPrice = chain.underlyingPrice;
    expirations = chain.expirationDates.map(
      d => new Date(d * 1000).toISOString().split("T")[0]
    );
    console.log(JSON.stringify({
      symbol: chain.underlyingSymbol,
      underlyingPrice: chain.underlyingPrice,
      expirations: expirations.slice(0, 10),
    }, null, 2));
  } catch (e) { console.error("Expirations error:", e.message); }

  console.log("");

  // 5. Options chain for nearest expiry (puts side, limit 10)
  console.log("--- 5. OPTIONS CHAIN (nearest expiry, puts, limit 10) ---");
  try {
    const chain = await fetchOptionChain(ticker);
    // Filter puts near the money
    let puts = chain.puts;
    if (underlyingPrice) {
      // Sort by distance from ATM
      puts = puts
        .map(p => ({ ...p, distFromATM: Math.abs(p.strike - underlyingPrice) }))
        .sort((a, b) => a.distFromATM - b.distFromATM)
        .slice(0, 10);
    } else {
      puts = puts.slice(0, 10);
    }
    console.log(JSON.stringify({
      expiration: chain.expirationDates[0] ? new Date(chain.expirationDates[0] * 1000).toISOString().split("T")[0] : "unknown",
      underlyingPrice: chain.underlyingPrice,
      maxPain: chain.maxPain,
      puts,
    }, null, 2));
  } catch (e) { console.error("Options chain error:", e.message); }

  console.log("");

  // 6. Options chain for NEXT WEEK expiry (puts, limit 10)
  console.log("--- 6. OPTIONS CHAIN (next week expiry, puts, limit 10) ---");
  try {
    // Find the second expiration (next week)
    if (expirations.length >= 2) {
      const nextWeekDate = expirations[1];
      const nextWeekUnix = Math.floor(new Date(nextWeekDate + "T00:00:00Z").getTime() / 1000);
      const chain2 = await fetchOptionChain(ticker, nextWeekUnix);
      let puts2 = chain2.puts;
      if (underlyingPrice) {
        puts2 = puts2
          .map(p => ({ ...p, distFromATM: Math.abs(p.strike - underlyingPrice) }))
          .sort((a, b) => a.distFromATM - b.distFromATM)
          .slice(0, 10);
      } else {
        puts2 = puts2.slice(0, 10);
      }
      console.log(JSON.stringify({
        expiration: nextWeekDate,
        underlyingPrice: chain2.underlyingPrice,
        maxPain: chain2.maxPain,
        puts: puts2,
      }, null, 2));
    } else {
      console.log("No next-week expiration available");
    }
  } catch (e) { console.error("Next week chain error:", e.message); }

  console.log("");

  const elapsed = Date.now() - startTime;
  console.log(`=== COMPLETE ===`);
  console.log(`End time: ${new Date().toISOString()}`);
  console.log(`Total elapsed: ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
