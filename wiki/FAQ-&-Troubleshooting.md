# FAQ & Troubleshooting

## Installation Issues

### "Tool not found" or Claude doesn't use stock-scanner tools

**Cause:** MCP server isn't configured or hasn't started.

**Fix:**
1. Verify your config is in the right file (`~/.claude.json` for global, `.mcp.json` for project)
2. Restart Claude Code after adding config
3. Test with: "What's the current price of AAPL?"

### "npx: command not found"

**Fix:** Install Node.js 18+ from [nodejs.org](https://nodejs.org/). npx comes with npm.

### Server starts but some tools are missing

**Cause:** Modules that require API keys are disabled because the keys aren't set.

**Fix:** Check the startup logs — the server prints which modules are enabled/disabled:
```
tradingview: enabled
finnhub: disabled -- missing FINNHUB_API_KEY
```

Add the missing keys to your MCP config's `env` section.

---

## Data Issues

### Quote returns empty or no data for a ticker

**Cause:** Some tickers need an exchange prefix.

**Fix:** Retry with the exchange prefix: `NYSE:CDE` instead of `CDE`, or `NASDAQ:SMCI` instead of `SMCI`.

### CoinGecko `coingecko_coin` returns "coin not found"

**Cause:** CoinGecko uses slugs, not ticker symbols.

**Fix:** Use the slug format:
- `"bitcoin"` not `"BTC"`
- `"ethereum"` not `"ETH"`
- `"cardano"` not `"ADA"`

Find the correct slug on [coingecko.com](https://www.coingecko.com/) — it's in the URL.

### Options chain returns no data

**Fix:**
1. First call `options_expirations` to see available dates
2. Use an exact date from that list in `options_chain`
3. Some tickers don't have listed options

### FRED indicator returns no data

**Cause:** Wrong series ID.

**Fix:** Use `fred_search` to discover the correct series ID:
```
Search FRED for "consumer confidence" — what's the series ID?
```

Then use the returned ID with `fred_indicator`.

### Economic calendar shows past dates

**Cause:** If running an older version (< v1.8.0), the calendar didn't filter to future dates.

**Fix:** Update to v1.8.0+:
```bash
npm install -g stock-scanner-mcp@latest
```

---

## Rate Limit Issues

### Alpha Vantage "rate limit exceeded"

**Cause:** Free tier allows only 5 calls/min and 25 calls/day.

**Fix:**
- Wait 60 seconds between Alpha Vantage requests
- Use `alphavantage_overview` with multiple tickers (batch mode) to save calls
- Use TradingView tools for quotes and technicals instead — they're free and unlimited
- Reserve Alpha Vantage for fundamentals, earnings, and dividends only

### Getting cached/stale data

**Cause:** In-memory cache serving previous results.

**Info:** Cache TTLs vary by source (1-30 minutes). Data refreshes automatically after TTL expires. This is by design to stay within rate limits.

---

## Common Questions

### Which tools should I use for real-time quotes?

Priority order:
1. `finnhub_quote` — real-time (requires API key)
2. `tradingview_quote` — 15-minute delay (free)
3. `alphavantage_quote` — real-time but rate-limited (requires API key)

### How do I get pre-market / after-hours data?

`tradingview_quote` includes pre-market and post-market data when available. Use `finnhub_market_status` to check which session is active.

### Can I scan for stocks on non-US exchanges?

The TradingView scanner defaults to US exchanges (NASDAQ, NYSE, AMEX). You can specify a different exchange with the `exchange` parameter, but coverage varies.

### What's the difference between `options_unusual_activity` and just looking at high volume?

Unusual activity looks at the **volume-to-open-interest ratio**, not just raw volume. A contract with 10,000 volume and 1,000 open interest (ratio: 10x) is more unusual than one with 50,000 volume and 200,000 open interest (ratio: 0.25x). High ratio = new positions being opened, which signals conviction.

### How do I read the TradingView recommendation values?

The `Recommend.All` field returns a value from -1 to +1:
- **-1 to -0.5:** Strong Sell
- **-0.5 to -0.1:** Sell
- **-0.1 to 0.1:** Neutral
- **0.1 to 0.5:** Buy
- **0.5 to 1:** Strong Buy

`Recommend.MA` is based on moving averages only. `Recommend.Other` is based on oscillators only.

### Can I use this outside of Claude Code?

stock-scanner-mcp is a standard MCP server. It works with any MCP-compatible client, not just Claude Code. The protocol is JSON-RPC over stdio.

### Is my data private?

Yes. The MCP server runs locally on your machine. Your API keys and queries go directly to the data providers (TradingView, SEC, Finnhub, etc.) — nothing passes through Anthropic or any intermediary.

---

## Getting Help

- **GitHub Issues:** [github.com/yyordanov-tradu/stock-scanner-mcp/issues](https://github.com/yyordanov-tradu/stock-scanner-mcp/issues)
- **npm Package:** [npmjs.com/package/stock-scanner-mcp](https://www.npmjs.com/package/stock-scanner-mcp)
