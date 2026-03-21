# API Keys & Rate Limits

## API Key Summary

| Provider | Env Variable | Free Tier | Signup Link |
|----------|-------------|-----------|-------------|
| Finnhub | `FINNHUB_API_KEY` | 30 calls/sec | [finnhub.io](https://finnhub.io/) |
| Alpha Vantage | `ALPHA_VANTAGE_API_KEY` | 5 calls/min, 25 calls/day | [alphavantage.co](https://www.alphavantage.co/support/#api-key) |
| FRED | `FRED_API_KEY` | No hard limit | [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) |

All three keys are free and take under a minute to get.

## Tools Available Without Any API Key (29 tools)

These modules work immediately with zero configuration:

| Module | Tools | Data Source |
|--------|-------|-------------|
| TradingView | 10 | TradingView scanner API |
| TradingView Crypto | 4 | TradingView scanner API |
| SEC EDGAR | 6 | SEC EDGAR EFTS + XBRL |
| CoinGecko | 3 | CoinGecko public API |
| Options | 5 | Yahoo Finance |
| Options CBOE | 1 | CBOE CDN |

## Rate Limits & Caching

All modules use in-memory TTL caching to stay within limits automatically.

| Data Source | Rate Limit | Cache TTL | Notes |
|-------------|-----------|-----------|-------|
| TradingView | No documented limit | — | Data is 15-min delayed |
| SEC EDGAR | 10 req/sec | 5 min | Requires User-Agent header (handled automatically) |
| CoinGecko | ~30 calls/min | 1 min | No API key needed for basic access |
| Yahoo Finance | No documented limit | 5 min | Options data; 15-min delayed |
| CBOE CDN | No documented limit | 30 min | End-of-day put/call ratio data |
| Finnhub | 30 calls/sec (free) | 5 min | Very generous free tier |
| Alpha Vantage | 5 calls/min, 25/day (free) | 1 min | Most restrictive; 12s delay between batch requests |
| FRED | No hard limit | 30 min | Very generous; data typically 1-2 weeks lagged |

## Alpha Vantage Tips

Alpha Vantage has the tightest free-tier limits (25 calls/day). To maximize value:

- **Use batch requests:** `alphavantage_overview` accepts up to 5 tickers at once
- **Cache-friendly:** Repeated calls within 1 minute hit cache, not the API
- **Use TradingView first:** For quotes and technicals, use the free TradingView tools. Reserve Alpha Vantage for fundamentals, earnings history, and dividends that only it provides
- **Consider a paid key:** $50/month gets 75 calls/min with no daily limit

## Data Freshness

| Data Type | Delay | Tools |
|-----------|-------|-------|
| Real-time | Seconds | `finnhub_quote`, `finnhub_market_status` |
| 15-minute delayed | 15 min | All TradingView tools, options tools |
| End-of-day | Next trading day | `options_put_call_ratio` |
| Economic data | 1-2 weeks | All FRED tools (depends on indicator release schedule) |
| SEC filings | Real-time | All EDGAR tools (available as soon as filed) |

## Error Handling

When rate limits are hit, tools return error responses with retry hints rather than crashing. Example:

```json
{
  "error": true,
  "code": "RATE_LIMITED",
  "message": "Alpha Vantage rate limit exceeded. Try again in 60 seconds."
}
```

The in-memory cache prevents most rate limit issues during normal use. If you're hitting limits, space out your requests or use cached-friendly batch patterns.
