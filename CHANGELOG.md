# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- **Breaking:** the workspace module now stores data in SQLite (`workspace.db`, via Node's built-in `node:sqlite`) instead of a monolithic `workspace.json`. Requires Node.js >= 22.13 when `--enable-workspace` is set; the server prints a clear message and exits on older versions. The `engines` field and CI matrix were raised accordingly (Node 22 and 24).
- Migration: on first start an existing `workspace.json` is validated and imported in a single transaction; the JSON file is left in place and refreshed as a mirror on every save, so rolling back to an older release keeps your data. If the JSON file is modified afterwards (for example by an older release), it is re-imported on the next start.
- Concurrent writers (a second Claude Code session or the sidecar) now get a retryable `Conflict` instead of a raw `database is locked` error; saves use `BEGIN IMMEDIATE`, WAL journaling and a 5s busy timeout.

### Removed
- `proper-lockfile` dependency (SQLite transactions replace file locking).

### Fixed
- The tsup bundle no longer strips the `node:` prefix from built-in imports (`tsup.config.ts`), and CI now smoke-tests the built `dist/` bundles.

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
