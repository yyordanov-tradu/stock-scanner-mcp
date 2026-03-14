# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-03-14

### Added
- TradingView stock scanning (scan, quote, technicals, top gainers, top volume, volume breakout)
- TradingView crypto scanning (scan, quote, technicals, top gainers)
- SEC EDGAR integration (search, company filings, company facts, insider trades, institutional holdings, ownership filings)
- CoinGecko crypto data (coin details, trending, global stats)
- Finnhub news and earnings (market news, company news, earnings calendar)
- Alpha Vantage fundamentals (quote, daily history, company overview)
- Modular architecture — modules auto-enable based on available API keys
- CLI options for module selection and default exchange
- In-memory TTL cache for rate-limited APIs
- MCP prompts for stock analysis and intraday candidate workflows
