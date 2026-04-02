# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.15.0] - 2026-04-02

### Added
- Frankfurter Forex module (5 new tools for exchange rates and currency conversion).
- Full "Trading Skills" catalog with 17+ MCP prompts and resources for market analysis.
- Unified "Skills Installer" for easier setup of MCP skills.
- GitHub Baseline Review artifact and documentation update to 54 tools across 11 modules.
- Added `beta` metric to Alpha Vantage company overview response.

### Changed
- Bumped @modelcontextprotocol/sdk to v1.28.0.
- Bumped Vitest to v4.1.2.
- Updated sidecar default port to 3200 (was 3100).

### Fixed
- Fixed malformed code block in README.md.

## [1.14.0] - 2026-03-30
(Intermediate version with major features previously added)
- Fred Economic Data module.
- Yahoo Finance Options module.
- Sentiment (Fear & Greed) module.
- Sidecar HTTP server for non-MCP integrations.

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
