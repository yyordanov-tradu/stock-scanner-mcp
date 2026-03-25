# Trading Skills for Claude Code

Ready-made trading workflows that orchestrate [stock-scanner-mcp](https://www.npmjs.com/package/stock-scanner-mcp) tools into professional analysis.

## Quick Start

**Prerequisites:** stock-scanner-mcp configured as an MCP server in Claude Code.

```bash
# Install skills to user scope (works in all projects)
cp -r skills/*/ ~/.claude/skills/

# Then in Claude Code, type:
/morning-briefing
```

## Skill Catalog

### Daily Routines

| Skill | Command | Description |
|-------|---------|-------------|
| Morning Briefing | `/morning-briefing` | Pre-market scan: indices, VIX, sectors, sentiment, top movers, earnings, economic calendar |
| Market Close Recap | `/market-close-recap` | End-of-day summary: session drivers, sector leaders/laggards, unusual volume, tomorrow's setup |
| Crypto Briefing | `/crypto-briefing` | Crypto overview: BTC/ETH/SOL quotes, fear/greed, trending coins, top gainers, technicals |

### Stock & Crypto Analysis

| Skill | Command | Description |
|-------|---------|-------------|
| Analyze Stock | `/analyze-stock AAPL` | Full equity deep dive: quote, technicals, fundamentals, analyst ratings, news, insider trades |
| Compare Stocks | `/compare AAPL MSFT GOOG` | Side-by-side comparison (2-5 stocks): valuation, growth, technicals, analyst sentiment, dividends |
| Analyze Crypto | `/analyze-crypto bitcoin` | Full crypto analysis: price, technicals, market data, sentiment, BTC dominance context |

### Trading Strategies

| Skill | Command | Description |
|-------|---------|-------------|
| Swing Setup | `/swing-setup` | Scan for swing trade setups: oversold bounces, breakouts, catalyst-driven moves |
| Earnings Play | `/earnings-play AAPL` | Pre-earnings options analysis: implied vs historical move, flow, insider activity, strategy suggestion |
| Options Flow | `/options-flow AAPL` | Smart money tracker: unusual options activity, put/call ratio, max pain, IV context |
| Dividend Screen | `/dividend-screen` | Income investing: scan high-yield stocks or deep-dive a single ticker's dividend sustainability |

### Macro & Economic

| Skill | Command | Description |
|-------|---------|-------------|
| Macro Dashboard | `/macro-dashboard` | Full macro picture: Fed funds, CPI, unemployment, yield curve, GDP, economic calendar |
| Fed Watch | `/fed-watch` | Fed meeting prep: inflation trend, employment data, yield curve, market stress, rate outlook |
| Sector Rotation | `/sector-rotation` | Sector rotation analysis: 11 sectors across timeframes, risk-on/risk-off classification |

### Risk & Due Diligence

| Skill | Command | Description |
|-------|---------|-------------|
| Insider Tracker | `/insider-tracker AAPL` | Insider activity: Form 4 trades, cluster detection, pre-earnings timing, activist filings |
| Smart Money | `/smart-money AAPL` | Institutional flow: 13F holdings, short interest, analyst consensus, unusual options activity |
| Risk Check | `/risk-check AAPL` | Pre-trade risk scorecard: 8-flag system covering VIX, RSI, short interest, earnings, IV, trend |

## API Key Requirements

Skills gracefully degrade when optional API keys are missing. Core analysis uses free tools (TradingView, SEC EDGAR, CoinGecko, Options, Sentiment). Optional keys unlock richer data:

| API Key | Skills Enhanced | What It Adds |
|---------|----------------|--------------|
| `FINNHUB_API_KEY` | Most skills | Real-time quotes, news, analyst ratings, earnings calendar |
| `ALPHA_VANTAGE_API_KEY` | analyze-stock, compare, earnings-play, dividend-screen | Fundamentals, daily history, earnings/dividend data |
| `FRED_API_KEY` | macro-dashboard, fed-watch, sector-rotation, dividend-screen | Economic indicators, calendar, rate data |

**Note:** macro-dashboard and fed-watch require `FRED_API_KEY` — they are economics-focused skills.

## Data Limitations

- TradingView and Yahoo Finance data is **15-minute delayed**
- CBOE put/call ratio and sentiment data is **end-of-day**
- FRED economic data updates on release schedule (monthly/quarterly)
- Always verify critical levels with real-time data before executing trades

## Installation Options

### Manual (current)

```bash
# User scope — works in all projects
cp -r skills/*/ ~/.claude/skills/

# Project scope — works only in this directory
mkdir -p .claude/skills
cp -r skills/*/ .claude/skills/

# Single skill only
cp -r skills/daily/morning-briefing ~/.claude/skills/
```

### Automated (coming soon)

```bash
npx stock-scanner-mcp install-skills
```

## Customization

Skills are plain markdown files. Fork and modify to fit your trading style:

- Adjust scan filters in swing-setup (RSI threshold, volume minimums)
- Change sector ETF lists in sector-rotation
- Modify risk-check flag thresholds
- Add tools to any skill's data collection wave

## Tool Reference

See [TOOLS.md](TOOLS.md) for a complete reference of all 49 MCP tools with parameters.
