# Tool Reference

Complete reference for all 47 tools. Tools are organized by module and listed with their parameters, defaults, and return data.

---

## TradingView — Stock Scanning (10 tools, no API key)

Data is 15-minute delayed.

### `tradingview_scan`

Scan US stocks with custom filters. The workhorse tool for screening.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `exchange` | string | — | Filter by exchange (e.g., `NASDAQ`, `NYSE`, `AMEX`) |
| `filters` | array | — | Array of filter objects: `{left, operation, right}` (e.g., `{left: "RSI", operation: "less", right: 30}`) |
| `columns` | array | 66 defaults | Columns to return (e.g., `["close", "volume", "RSI"]`) |
| `timeframe` | enum | `1d` | `1m`, `5m`, `15m`, `1h`, `4h`, `1d`, `1W`, `1M` |
| `limit` | number | 50 | Max rows to return |

**Returns:** Array of stock rows with requested columns (name, description, plus selected metrics).

### `tradingview_compare_stocks`

Side-by-side comparison of 2-5 stocks.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tickers` | array | *required* | 2-5 ticker symbols to compare |

**Returns:** For each ticker: name, description, price, change %, market cap, P/E, EPS, revenue, dividend yield, RSI, overall recommendation.

### `tradingview_quote`

Get quotes for one or more tickers. Includes pre-market and post-market data when available.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tickers` | array | *required* | Array of ticker symbols |

**Returns:** Price, change, change %, volume, market cap, name, description, pre/post-market data.

**Tip:** If a ticker returns empty, retry with exchange prefix (e.g., `NYSE:CDE` instead of `CDE`).

### `tradingview_technicals`

Technical indicators across multiple timeframes.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tickers` | array | *required* | Array of ticker symbols |
| `timeframe` | enum | `1d` | `1m`, `5m`, `15m`, `1h`, `4h`, `1d`, `1W`, `1M` |

**Returns:** Overall/MA/Oscillator recommendations, RSI, Stochastic K/D, CCI, ADX, MACD, Bollinger Bands, EMA/SMA (20/50/200), Pivot Points.

### `tradingview_top_gainers`

Today's top gaining stocks by percentage change.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `exchange` | string | — | Filter by exchange |
| `include_otc` | boolean | `false` | Include OTC and penny stocks |
| `limit` | number | 20 | Max results |

**Returns:** Price, change %, volume, market cap, name, description. Filters to market cap > $100M by default.

### `tradingview_top_losers`

Today's top losing stocks. Same parameters and return shape as `top_gainers`.

### `tradingview_top_volume`

Stocks with the highest trading volume today. Same parameters as `top_gainers`.

**Returns:** Volume, price, change %, name, description, market cap.

### `tradingview_market_indices`

Real-time major market indices. No parameters.

**Returns:** VIX, S&P 500, NASDAQ Composite, Dow Jones — each with price, change, high, low, open.

**Tip:** Always check this first for market context. VIX > 20 = elevated fear, VIX > 30 = panic.

### `tradingview_sector_performance`

S&P 500 sector ETF performance. No parameters.

**Returns:** All 11 sector ETFs (XLK, XLF, XLE, XLV, XLI, XLP, XLU, XLY, XLC, XLRE, XLB) with price, change, weekly/monthly/3-month/YTD performance.

### `tradingview_volume_breakout`

Stocks with unusual volume (2x+ their 10-day average).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `exchange` | string | — | Filter by exchange |
| `limit` | number | 20 | Max results |

**Returns:** Volume, relative volume (vs 10-day avg), price, change %, name, market cap, RSI, MACD. Filters to market cap > $100M, volume > 1M.

---

## TradingView Crypto — Crypto Scanning (4 tools, no API key)

Data is 15-minute delayed. Defaults to major exchanges: BINANCE, COINBASE, KRAKEN, OKX, BYBIT, BITSTAMP.

### `crypto_scan`

Scan crypto pairs with custom filters.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `filters` | array | — | Filter objects like stock scan |
| `major_only` | boolean | `true` | Restrict to major exchanges |
| `columns` | array | 23 defaults | Columns to return |
| `timeframe` | enum | `1d` | `1m`, `5m`, `15m`, `1h`, `4h`, `1d`, `1W`, `1M` |
| `limit` | number | 50 | Max 200 |

### `crypto_quote`

Real-time crypto quotes.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbols` | array | *required* | e.g., `["BTCUSDT", "ETHUSDT"]` |

**Returns:** Price, change, volume, market cap, description. Defaults to BINANCE if no exchange prefix.

### `crypto_technicals`

Technical analysis for crypto pairs. Same indicator set as stock technicals.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbols` | array | *required* | Crypto pair symbols |
| `timeframe` | enum | `1d` | Same timeframes as stock technicals |

### `crypto_top_gainers`

Top gaining crypto pairs by percentage change.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `exchange` | string | — | Specific exchange |
| `limit` | number | 20 | Max 50 |

---

## SEC EDGAR — Filings & Ownership (6 tools, no API key)

Real-time data directly from the SEC. Rate limit: 10 req/sec.

### `edgar_search`

Full-text search across all SEC filings. Best for finding trends, technologies, or events across companies.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | *required* | Search terms (e.g., `"lithium mining"`, `"AI infrastructure"`) |
| `dateRange` | string | — | `"YYYY-MM-DD,YYYY-MM-DD"` format |
| `forms` | array | — | Filter by form type: `["10-K", "10-Q", "8-K"]` |
| `tickers` | array | — | Filter by tickers |
| `limit` | number | 20 | Max 50 |

**Returns:** Filing metadata with accession numbers, form types, and direct SEC.gov links.

### `edgar_company_filings`

Recent official filings for a specific company.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ticker` | string | *required* | Stock ticker |
| `forms` | array | — | Filter form types |
| `limit` | number | 10 | Max 50 |

### `edgar_company_facts`

Financial metrics extracted from SEC XBRL data — more reliable than text extraction.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ticker` | string | *required* | Stock ticker |

**Returns:** Revenue, Net Income, EPS, Total Assets, Total Liabilities.

### `edgar_insider_trades`

Insider buy/sell activity (Forms 3, 4, 5).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ticker` | string | *required* | Stock ticker |
| `limit` | number | 10 | Max results |

**Returns:** Insider name, title, transaction type (buy/sell), share amount, price.

### `edgar_institutional_holdings`

Track institutional 'big money' moves via Form 13F.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | *required* | Ticker OR manager name (e.g., `"AAPL"` or `"Berkshire Hathaway"`) |
| `limit` | number | 10 | Max results |

**Returns:** Institution name, holdings, stake percentage.

### `edgar_ownership_filings`

Major ownership changes (5%+ stakes) — 13D/13G activist investor filings.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ticker` | string | *required* | Stock ticker |
| `limit` | number | 10 | Max results |

**Returns:** Activist investor name, stake %, filing date.

---

## CoinGecko — Crypto Intelligence (3 tools, no API key)

Rate limit: ~30 calls/min.

### `coingecko_coin`

Detailed crypto info by coin ID.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `coinId` | string | *required* | CoinGecko slug: `"bitcoin"`, `"ethereum"`, `"solana"` — **NOT** ticker symbols |

**Returns:** Price, market cap, volume, 24h change, all-time high/low, total supply, links.

### `coingecko_trending`

Top 7 trending cryptos by 24-hour search popularity. No parameters.

### `coingecko_global`

Global crypto market stats. No parameters.

**Returns:** Total market cap (BTC & USD), 24h volume, BTC dominance %, ETH dominance %.

---

## Options — Chains, Greeks & Flow (5 tools, no API key)

Data from Yahoo Finance, 15-minute delayed.

### `options_expirations`

Get available expiration dates. **Call this first** before using other options tools.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | string | *required* | e.g., `"AAPL"` or `"NYSE:GM"` |

**Returns:** Array of expiration dates (YYYY-MM-DD), underlying symbol, underlying price.

### `options_chain`

Full options chain with calculated Greeks.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | string | *required* | Stock ticker |
| `expiration` | string | nearest | YYYY-MM-DD |
| `side` | enum | `both` | `call`, `put`, `both` |
| `limit` | number | 50 | Max 200 |
| `strike_min` | number | — | Minimum strike price |
| `strike_max` | number | — | Maximum strike price |
| `all_strikes` | boolean | `false` | Return all strikes (overrides min/max) |

**Returns:** For each contract: strike, bid, ask, last price, volume, open interest, implied volatility, delta, gamma, theta, vega.

**Default range:** +/-20% around the current stock price. Use `strike_min`/`strike_max` or `all_strikes=true` for wider range.

### `options_unusual_activity`

'Smart money' signal — contracts with volume/OI ratio above threshold.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | string | *required* | Stock ticker |
| `volume_oi_ratio` | number | 3.0 | Minimum volume/OI ratio |
| `min_volume` | number | 100 | Minimum contract volume |
| `side` | enum | `both` | `call`, `put`, `both` |

**Returns:** Top 20 unusual contracts with strike, side, volume, open interest, volume/OI ratio, and Greeks.

### `options_max_pain`

Strike price where cumulative open interest expires worthless. Acts as a support/resistance magnet near expiration.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | string | *required* | Stock ticker |
| `expiration` | string | nearest | YYYY-MM-DD |

**Returns:** Max pain strike, underlying price, expiration date.

### `options_implied_move`

Expected move from ATM straddle pricing.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | string | *required* | Stock ticker |
| `expiration` | string | nearest | YYYY-MM-DD |

**Returns:** ATM call/put prices, straddle price, implied move (% and absolute), implied volatility, expected range (low/high).

**Tip:** Compare implied move vs historical move to assess whether options premium is cheap or expensive.

---

## Options CBOE — Put/Call Sentiment (1 tool, no API key)

End-of-day data from CBOE.

### `options_put_call_ratio`

Market-wide put/call ratio — a contrarian sentiment indicator.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | enum | `total` | `total` (all), `equity` (stocks only), `index` (index options) |
| `days` | number | 30 | Max 252 (1 trading year) |

**Returns:** Historical daily put/call ratios.

**Reading the ratio:**
- **> 1.0** — More puts than calls = bearish sentiment (contrarian bullish)
- **0.7 - 1.0** — Neutral
- **< 0.7** — More calls than puts = bullish/complacent (contrarian bearish)

---

## Finnhub — News, Earnings & Macro (9 tools, requires `FINNHUB_API_KEY`)

Real-time data. [Get free API key](https://finnhub.io/).

### `finnhub_quote`

Real-time stock quote — preferred over TradingView during market hours.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | string | *required* | Stock ticker |

**Returns:** Price, change, change %, day high/low, open, previous close.

### `finnhub_company_profile`

Comprehensive company information.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | string | *required* | Stock ticker |

**Returns:** Name, industry, market cap, IPO date, logo URL, website, share count, exchange.

### `finnhub_peers`

Find comparable companies in the same industry.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | string | *required* | Stock ticker |

**Returns:** Array of peer ticker symbols.

### `finnhub_market_status`

Check if an exchange is open and which session is active.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `exchange` | string | `US` | Exchange code: `US`, `L` (London), `T` (Tokyo), `HK` (Hong Kong) |

**Returns:** Open/closed status, current session (pre-market/regular/post-market).

### `finnhub_market_news`

Latest market news by category.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category` | enum | — | `general`, `forex`, `crypto`, `merger` |
| `limit` | number | 20 | Max 50 |

### `finnhub_company_news`

Company-specific news within a date range.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | string | *required* | Stock ticker |
| `from` | string | *required* | Start date YYYY-MM-DD |
| `to` | string | *required* | End date YYYY-MM-DD |
| `limit` | number | 20 | Max 50 |

### `finnhub_earnings_calendar`

Upcoming and historical earnings reports.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `from` | string | *required* | Start date YYYY-MM-DD |
| `to` | string | *required* | End date YYYY-MM-DD |
| `symbol` | string | — | Filter to one ticker |
| `limit` | number | 20 | Max 100 |

**Returns:** Company, date, EPS estimate, EPS actual, surprise %.

### `finnhub_analyst_ratings`

Current consensus recommendation and rating history.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | string | *required* | Stock ticker |

**Returns:** Current consensus (buy/hold/sell counts), plus last 4 months of rating changes.

### `finnhub_short_interest`

Short interest data and key financial metrics.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | string | *required* | Stock ticker |

**Returns:** Short interest %, short ratio, float, % of float shorted.

---

## Alpha Vantage — Fundamentals & Price History (5 tools, requires `ALPHA_VANTAGE_API_KEY`)

[Get free API key](https://www.alphavantage.co/support/#api-key). Free tier: 5 calls/min, 25 calls/day.

### `alphavantage_quote`

Real-time stock quote.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | string | *required* | Stock ticker |

### `alphavantage_daily`

Daily OHLCV price history.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | string | *required* | Stock ticker |
| `limit` | number | 30 | Max 100 trading days |

**Returns:** Array of daily bars: date, open, high, low, close, volume.

### `alphavantage_overview`

Company fundamentals. Supports batch requests (up to 5 tickers).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbols` | string or array | *required* | Single ticker or array of 1-5 tickers |

**Returns:** P/E ratio, market cap, sector, industry, analyst target price, earnings data.

**Note:** Batch requests add a 12-second delay between calls to respect rate limits.

### `alphavantage_earnings_history`

Historical EPS actual vs estimate.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | string | *required* | Stock ticker |
| `limit` | number | 8 | Max 20 quarters |

### `alphavantage_dividend_history`

Historical dividend payments.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | string | *required* | Stock ticker |

**Returns:** Array of dividends: ex-date, pay date, amount.

---

## FRED — US Economic Data (4 tools, requires `FRED_API_KEY`)

[Get free API key](https://fred.stlouisfed.org/docs/api/api_key.html).

### `fred_economic_calendar`

Upcoming high-impact US economic releases.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 60 | Max raw results to fetch before filtering |

**Returns:** Upcoming dates for FOMC, CPI, PPI, NFP, GDP, PCE, jobless claims, retail sales, ISM, housing starts.

### `fred_indicator`

Latest value for any US economic indicator.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `series_id` | string | *required* | FRED series ID or alias |

**Built-in aliases:** `cpi`, `core_cpi`, `ppi`, `gdp`, `unemployment`, `nonfarm_payrolls`, `fed_funds`, `treasury_10y`, `treasury_2y`, `initial_claims`, `core_pce`

**Returns:** Series metadata (title, frequency, units) and latest observation (date, value).

### `fred_indicator_history`

Historical values for any indicator with optional unit transformation.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `series_id` | string | *required* | FRED series ID or alias |
| `start_date` | string | *required* | YYYY-MM-DD |
| `end_date` | string | *required* | YYYY-MM-DD |
| `units` | enum | `lin` | `lin` (raw), `chg` (change), `pch` (% change), `pc1` (YoY % change) |

**Tip:** Use `units: "pc1"` with CPI or PPI to get YoY inflation rates directly.

### `fred_search`

Discover FRED series IDs by keyword.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | *required* | Search terms (e.g., `"housing starts"`, `"consumer confidence"`) |
| `limit` | number | 10 | Max 50 |

**Returns:** Matching series with ID, title, frequency, units, popularity score.
