---
name: workspace-morning-brief
description: Run a tailored pre-market scan that prioritizes the context from your saved profile and watchlists.
---

# Workspace Morning Brief

## Overview

A highly tailored morning brief that reads the user's saved trading profile, watchlist, and global theses, and cross-references them against current market data. It specifically looks for correlations (e.g., crypto proxies vs BTC), earnings events, news flow, and macro catalysts that impact the user's specific saved names.

Announce at start: "Running personalized morning brief -- reading workspace context and cross-referencing market catalysts..."

## Execution Flow

### STEP 1: READ CONTEXT (Required Sequence)
You MUST execute these tool calls first to understand what matters to the user today.
1. Call `workspace_get_profile` to read the trading style.
2. Call `workspace_list_watchlists` to see which symbols are saved (focus on the 'core' watchlist).
3. If the user has saved symbols, call `workspace_get_thesis` for up to 3 of the most critical symbols to read the existing context.

### STEP 2: FETCH TARGETED DATA
Based ONLY on the symbols found in the user's workspace, fetch relevant data using the MCP tools:
- **Crypto Exposure Check:** If the watchlist contains crypto-exposed equities (e.g., MARA, CIFR, COIN) or Bitcoin, you MUST fetch the current price and 24h change of BTC (using `tradingview_quote` for `BINANCE:BTCUSDT`). Evaluate the correlation and note if the stocks are tracking or diverging from the BTC move.
- **Event Risk Check:** For active equity names (e.g., HOOD, SOFI), check for upcoming earnings today using `finnhub_earnings_calendar` and recent news using `finnhub_company_news`.
- **Risk Tone Check:** If the watchlist contains Gold or Silver (or proxies like GLD/SLV), fetch their current prices. Note any sharp moves that might change the overall market risk tone.
- **Market Pulse:** Fetch a basic S&P 500 / VIX quote (`tradingview_quote` for `SPY` and `VIX`) to establish the baseline market direction.

### STEP 3: SYNTHESIZE THE BRIEF
Do NOT give a generic, broad market recap. Structure your response to answer the following questions specifically about the user's watchlist:

#### 1. What Matters Today
Highlight the overarching theme for the user's specific portfolio (e.g., "Crypto proxies are leading the market today," or "A defensive risk-off tone driven by a drop in Gold").

#### 2. Active Names & Event Risk
List the tickers from the watchlist that are moving significantly (pre-market or early trading) or have an immediate catalyst (Earnings, News, Options Flow).
*Format:* [Ticker] | [Change %] | [Reason / Event]

#### 3. Thesis Follow-Up
Based on today's price action and the saved thesis records, note if any specific thesis deserves a follow-up or re-evaluation. (e.g., "MARA is breaking below your stated thesis support level while BTC remains flat — re-evaluation may be needed.")

## Limitations
- Do not dump raw tool outputs.
- If a ticker has no news and isn't moving, do not list it in the "Active Names" section.
- Respect the user's stated `workflowCadence` from the profile. If it's weekly, briefly zoom out the context to the 5-day trend.
