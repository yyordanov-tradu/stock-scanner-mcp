# stock-scanner Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Claude Code Plugin that gives Claude access to stock and crypto market data via 19 MCP tools across 6 data source modules, plus a slash command, agent, and skill.

**Architecture:** Plugin shell first (metadata, command, agent, skill), then MCP server with shared infrastructure (HTTP client, cache, config), then modules one at a time starting with TradingView (no API key needed, can test immediately). Each module is self-contained with its own directory, tools, and tests.

**Tech Stack:** TypeScript, Node.js, `@modelcontextprotocol/sdk`, Zod, vitest, tsup

---

## Task Overview

| # | Task | Tools | Depends On |
|---|------|-------|------------|
| 1 | [Project Scaffolding](tasks/task-01-scaffolding.md) | -- | -- |
| 2 | [Plugin Shell](tasks/task-02-plugin-shell.md) | -- | 1 |
| 3 | [Shared Types](tasks/task-03-shared-types.md) | -- | 1 |
| 4 | [HTTP Client](tasks/task-04-http-client.md) | -- | 1 |
| 5 | [TTL Cache](tasks/task-05-cache.md) | -- | 1 |
| 6 | [Config & Registry](tasks/task-06-config-registry.md) | -- | 3 |
| 7 | [MCP Server Entry Point](tasks/task-07-mcp-server.md) | -- | 3, 6 |
| 8 | [TradingView Stock Scanner](tasks/task-08-tradingview.md) | 5 tools | 4, 7 |
| 9 | [TradingView Crypto Scanner](tasks/task-09-tradingview-crypto.md) | 4 tools | 4, 7 |
| 10 | [SEC EDGAR](tasks/task-10-sec-edgar.md) | 2 tools | 4, 5, 7 |
| 11 | [CoinGecko](tasks/task-11-coingecko.md) | 3 tools | 4, 5, 7 |
| 12 | [Finnhub](tasks/task-12-finnhub.md) | 2 tools | 4, 5, 7 |
| 13 | [Alpha Vantage](tasks/task-13-alpha-vantage.md) | 3 tools | 4, 5, 7 |
| 14 | [Integration Test](tasks/task-14-integration-test.md) | -- | 8-13 |
| 15 | [README](tasks/task-15-readme.md) | -- | 14 |

**Total: 19 MCP tools across 6 modules**

---

## Module Summary

| Module | Tools | API Key | API Base URL |
|--------|-------|---------|-------------|
| tradingview | 5 | None | `https://scanner.tradingview.com/america/scan` |
| tradingview-crypto | 4 | None | `https://scanner.tradingview.com/crypto/scan` |
| sec-edgar | 2 | None | `https://efts.sec.gov/LATEST/search-index` |
| coingecko | 3 | None | `https://api.coingecko.com/api/v3` |
| finnhub | 2 | `FINNHUB_API_KEY` | `https://finnhub.io/api/v1` |
| alpha-vantage | 3 | `ALPHA_VANTAGE_API_KEY` | `https://www.alphavantage.co/query` |
