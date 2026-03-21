# Example Prompts

Copy-paste these prompts directly into Claude Code. They're organized from simple lookups to complex multi-tool analysis chains.

---

## Quick Lookups

### Prices & Quotes

```
What's the current price of AAPL?
```

```
Get me quotes for AAPL, MSFT, GOOGL, and AMZN
```

```
Is the market open right now?
```

```
Show me today's market indices — S&P 500, NASDAQ, Dow, and VIX
```

### Market Movers

```
What are the top 10 gaining stocks today?
```

```
Show me today's biggest losers
```

```
Which stocks have the highest volume today?
```

```
Find stocks with unusual volume breakouts today
```

### Crypto

```
What's Bitcoin trading at right now?
```

```
What's trending in crypto?
```

```
Show me the global crypto market cap and BTC dominance
```

```
Get me quotes for BTCUSDT, ETHUSDT, and SOLUSDT
```

---

## Technical Analysis

### Single Stock

```
Show me the technicals for AAPL on the daily timeframe
```

```
What's the RSI and MACD for TSLA on the 1-hour chart?
```

```
Give me the full technical picture for NVDA — daily and weekly timeframes
```

### Screening

```
Find stocks where RSI is below 30 (oversold) on the daily timeframe
```

```
Scan for stocks with RSI above 70, price above $50, and volume over 2 million
```

```
Find crypto pairs on the daily timeframe where RSI is below 25
```

### Comparisons

```
Compare AAPL, MSFT, and GOOGL side by side — price, P/E, market cap, RSI, and analyst recommendations
```

```
Compare NVDA and AMD — which one looks better technically and fundamentally right now?
```

---

## Options Analysis

### Basic

```
What expiration dates are available for AAPL options?
```

```
Show me the AAPL options chain for next Friday's expiration
```

```
What's the max pain for SPY this week?
```

### Flow & Sentiment

```
Is there any unusual options activity on TSLA?
```

```
Show me the implied move for AAPL ahead of earnings
```

```
What's the put/call ratio trend for the last 30 days? Is the market leaning bullish or bearish?
```

### Pre-Earnings Options Setup

```
AAPL reports earnings next week. Show me:
1. The options chain for the expiration right after earnings
2. The implied move (expected range)
3. Any unusual options activity
4. The max pain strike
```

---

## Fundamental Research

### Company Analysis

```
Give me the full fundamental overview of AAPL — P/E, market cap, sector, analyst target
```

```
Show me AAPL's last 8 quarters of earnings — did they beat estimates?
```

```
What's MSFT's dividend history?
```

### SEC Filings & Insider Activity

```
Have any insiders been buying or selling AAPL stock recently?
```

```
Show me the latest 10-K and 10-Q filings for TSLA
```

```
Which institutions hold the most AAPL stock?
```

```
Search SEC filings for "artificial intelligence" in 10-K filings from the last 6 months
```

```
Are there any activist investors (13D filings) in Disney?
```

```
What is Berkshire Hathaway's current portfolio? Search their 13F holdings
```

---

## News & Events

### Market News

```
What's the latest market news?
```

```
Show me crypto news from Finnhub
```

```
What's been in the news about NVDA in the last week?
```

### Earnings

```
What earnings are coming up this week?
```

```
Show me all earnings reports for next week with EPS estimates
```

```
Did AAPL beat earnings last quarter? Show me the surprise %
```

### Short Interest

```
What's the short interest on GME?
```

```
Is TSLA heavily shorted right now?
```

---

## Economic & Macro Data

### Current Indicators

```
What's the current fed funds rate?
```

```
Show me the latest CPI, unemployment rate, and GDP
```

```
What's the 10-year treasury yield right now?
```

### Inflation Analysis

```
Show me the YoY CPI inflation rate for the last 12 months
```

```
What's the trend of core PCE inflation since January 2025?
```

### Economic Calendar

```
What high-impact economic events are coming up?
```

```
When is the next FOMC meeting and CPI release?
```

### Interest Rate Analysis

```
Show me the fed funds rate history for 2025 — chart the rate cuts
```

```
Compare the 2-year and 10-year treasury yields over the last 6 months. Is the yield curve inverted?
```

### Discovering Indicators

```
Search FRED for "consumer confidence" — what series are available?
```

```
Find FRED indicators related to housing starts and show me the latest values
```

---

## Sector Analysis

```
Show me sector performance — which sectors are leading and lagging today?
```

```
Which sectors have performed best over the last 3 months?
```

```
Compare XLK (tech) and XLE (energy) performance — weekly, monthly, and YTD
```

---

## Multi-Tool Analysis Chains

These prompts trigger Claude to use multiple tools together for deeper analysis:

### Full Stock Report

```
Give me a complete analysis of NVDA:
- Current price and today's move
- Technical indicators (daily)
- Analyst consensus and short interest
- Latest news from the past week
- Insider trading activity
- Options flow — any unusual activity?
- How does it compare to AMD?
```

### Market Health Check

```
Give me a full market health check:
- Major indices (S&P, NASDAQ, Dow, VIX)
- Sector performance breakdown
- Put/call ratio (sentiment)
- Top gainers and losers today
- Volume breakout stocks
- Upcoming economic events
```

### Pre-Earnings Research

```
I'm considering a position in MSFT before earnings. Help me research:
1. Current price and technicals
2. Last 4 quarters of earnings surprises
3. Analyst ratings and price target
4. Options implied move for earnings week
5. Any unusual options activity
6. Insider trading in the last 90 days
7. Company news from the last 2 weeks
```

### Macro + Market Setup

```
Give me the macro picture right now:
- Fed funds rate and recent trajectory
- CPI and core PCE inflation trends (last 6 months, YoY)
- 10-year treasury yield
- Upcoming economic calendar
- VIX level
- How are rate-sensitive sectors (XLU, XLRE) performing vs growth (XLK)?
```

### Crypto Deep Dive

```
Deep dive on the crypto market:
- Global market cap and BTC dominance
- BTC and ETH quotes with technicals
- What's trending on CoinGecko?
- Top gainers in crypto today
- Crypto news from Finnhub
```

### Income Investing Screen

```
Help me find dividend stocks:
1. Scan for stocks with dividend yield above 3%, market cap above $10B
2. For the top 5 results, show me:
   - Dividend history (consistency)
   - P/E ratio and fundamentals
   - Technical setup (RSI, trend)
   - Any insider buying activity
```

### Options Strategy Research

```
I want to sell a cash-secured put on AAPL. Help me decide:
1. Current price and technicals
2. Support levels from pivot points
3. Max pain for the next monthly expiration
4. Options chain — focus on puts 5-10% below current price
5. Implied volatility vs put/call ratio (is premium rich or cheap?)
6. Any upcoming catalysts (earnings, economic events)?
```
