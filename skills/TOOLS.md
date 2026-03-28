# stock-scanner-mcp Tool Reference

Quick reference for all 54 MCP tools available to trading skills.

## TradingView (10 tools)

| Tool | Purpose | Key Params |
|------|---------|------------|
| `tradingview_scan` | Custom stock scan with filters | exchange, filters, columns, timeframe, limit |
| `tradingview_quote` | Stock quote (15m delayed) | tickers (array) |
| `tradingview_technicals` | RSI, MACD, MAs, pivots | tickers, timeframe |
| `tradingview_compare_stocks` | Side-by-side comparison (2-5) | tickers (array) |
| `tradingview_top_gainers` | Top gaining stocks by % change | exchange, limit |
| `tradingview_top_losers` | Top losing stocks by % change | exchange, limit |
| `tradingview_top_volume` | Highest volume stocks | exchange, limit |
| `tradingview_market_indices` | VIX, S&P 500, NASDAQ, Dow | (none) |
| `tradingview_sector_performance` | 11 sector ETFs with W/M/3M/YTD | (none) |
| `tradingview_volume_breakout` | Unusual volume stocks | exchange, limit |

## TradingView Crypto (4 tools)

| Tool | Purpose | Key Params |
|------|---------|------------|
| `crypto_scan` | Custom crypto scan with filters | filters, columns, timeframe, limit |
| `crypto_quote` | Crypto pair quote | symbols (array) |
| `crypto_technicals` | Crypto technical indicators | symbols, timeframe |
| `crypto_top_gainers` | Top gaining crypto pairs | exchange, limit |

## SEC EDGAR (6 tools)

| Tool | Purpose | Key Params |
|------|---------|------------|
| `edgar_search` | Search filings by keyword | query, dateRange, forms, tickers, limit |
| `edgar_company_filings` | Company's recent filings | ticker, forms, limit |
| `edgar_company_facts` | XBRL financial metrics | ticker |
| `edgar_insider_trades` | Form 4 insider transactions | ticker, limit |
| `edgar_institutional_holdings` | 13F institutional holdings | query, limit |
| `edgar_ownership_filings` | 13D/13G activist stakes | ticker, limit |

## Finnhub (9 tools)

| Tool | Purpose | Key Params |
|------|---------|------------|
| `finnhub_quote` | Real-time stock quote | symbol |
| `finnhub_company_profile` | Company info, industry, MCap | symbol |
| `finnhub_peers` | Comparable companies | symbol |
| `finnhub_market_status` | Exchange open/closed status | exchange |
| `finnhub_market_news` | Market news by category | category, limit |
| `finnhub_company_news` | Company-specific news | symbol, from, to, limit |
| `finnhub_earnings_calendar` | Upcoming/historical earnings | from, to, symbol, limit |
| `finnhub_analyst_ratings` | Analyst consensus ratings | symbol |
| `finnhub_short_interest` | Short interest metrics | symbol |

## Alpha Vantage (5 tools)

| Tool | Purpose | Key Params |
|------|---------|------------|
| `alphavantage_quote` | Real-time quote | symbol |
| `alphavantage_daily` | Daily OHLCV history | symbol, limit |
| `alphavantage_overview` | Fundamentals, P/E, sector | symbols |
| `alphavantage_earnings_history` | EPS actual vs estimate | symbol, limit |
| `alphavantage_dividend_history` | Dividend payment history | symbol |

## CoinGecko (3 tools)

| Tool | Purpose | Key Params |
|------|---------|------------|
| `coingecko_coin` | Detailed crypto info (use slug IDs) | coinId |
| `coingecko_trending` | Top 7 trending coins | (none) |
| `coingecko_global` | Global crypto market stats | (none) |

## Options (5 tools)

| Tool | Purpose | Key Params |
|------|---------|------------|
| `options_expirations` | Available expiry dates | symbol |
| `options_chain` | Full chain with Greeks | symbol, expiration, side, limit |
| `options_unusual_activity` | High volume/OI ratio contracts | symbol, volume_oi_ratio, side |
| `options_max_pain` | Max pain strike calculation | symbol, expiration |
| `options_implied_move` | ATM straddle implied move | symbol, expiration |

## Options CBOE (1 tool)

| Tool | Purpose | Key Params |
|------|---------|------------|
| `options_put_call_ratio` | CBOE put/call ratio history | type (total/equity/index), days |

## FRED (4 tools)

| Tool | Purpose | Key Params |
|------|---------|------------|
| `fred_economic_calendar` | Upcoming economic releases | limit |
| `fred_indicator` | Latest value of an indicator | series_id |
| `fred_indicator_history` | Historical indicator values | series_id, start_date, end_date, units |
| `fred_search` | Search FRED series by keyword | query, limit |

## Sentiment (2 tools)

| Tool | Purpose | Key Params |
|------|---------|------------|
| `sentiment_fear_greed` | CNN Fear & Greed Index (0-100) | (none) |
| `sentiment_crypto_fear_greed` | Crypto Fear & Greed (0-100) | (none) |

## Frankfurter (5 tools)

| Tool | Purpose | Key Params |
|------|---------|------------|
| `frankfurter_latest` | Latest forex exchange rates (ECB, 31 currencies) | base, symbols |
| `frankfurter_historical` | Rates for a specific past date | date, base, symbols |
| `frankfurter_timeseries` | Daily rate history (max 90 days) | start_date, end_date, base, symbols |
| `frankfurter_convert` | Convert amount between currencies | amount, from, to |
| `frankfurter_currencies` | List all 31 supported currency codes | (none) |
