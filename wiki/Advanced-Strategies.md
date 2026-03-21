# Advanced Strategies

Power-user techniques to get the most out of stock-scanner-mcp. These strategies combine multiple tools into analysis workflows that rival professional terminal access.

---

## Strategy 1: The Morning Brief

Run this at market open (or pre-market) to get a complete picture before making any decisions:

```
Morning market brief:
1. Market indices — are we opening up or down? What's the VIX?
2. Sector performance — where is money rotating today?
3. Top gainers and losers — what's moving?
4. Volume breakouts — what has unusual institutional interest?
5. Economic calendar — any catalysts today?
6. Put/call ratio — what's the sentiment?
```

**Why it works:** Covers the same ground a trader's morning workflow does — market direction, sector rotation, movers, volume anomalies, macro catalysts, and sentiment — all in one ask.

---

## Strategy 2: Smart Money Tracking

Follow institutional and insider moves to spot conviction:

```
Show me smart money signals:
1. Unusual options activity on the top 5 S&P 500 stocks by volume today
2. Recent insider buying across any stocks (not selling — buying specifically)
3. Institutional holdings changes — search 13F filings for recent large position changes
4. Compare the put/call ratio (equity vs index) — are institutions hedging via index puts?
```

**Reading the signals:**
- Insider buying + unusual call activity = strong bullish conviction
- Rising index put/call ratio + declining equity put/call = institutions hedging but staying long
- Large 13F position increases + volume breakout = institutional accumulation

---

## Strategy 3: Earnings Season Playbook

Use this workflow for every earnings play:

### Pre-Earnings (1-2 weeks before)

```
[TICKER] reports earnings on [DATE]. Pre-earnings analysis:
1. Last 4 quarters — beat or miss pattern
2. Analyst consensus — any recent upgrades/downgrades?
3. Options implied move vs last quarter's actual move
4. Unusual options activity — is smart money positioning?
5. Insider trading last 90 days — are executives buying or selling?
6. Technical setup — what's the trend going into earnings?
7. Short interest — is there squeeze potential on a beat?
```

### Post-Earnings (morning after)

```
[TICKER] just reported earnings. Post-earnings check:
1. Current quote — what's the gap?
2. Did the actual move exceed the implied move?
3. Any unusual options activity now? (rolling, adjusting)
4. Company news — what are analysts saying?
5. Technical levels — where's support if it's selling off?
```

---

## Strategy 4: Relative Strength Rotation

Identify which sectors and stocks are gaining relative strength:

```
Sector rotation analysis:
1. Show sector performance — weekly, monthly, and 3-month
2. For the top 2 performing sectors, scan for stocks with:
   - RSI between 50-70 (trending but not overbought)
   - Volume breakout (institutional interest)
   - Positive change today
3. For the bottom 2 performing sectors, flag any stocks showing divergent strength
   (positive RSI divergence in a weak sector = potential rotation leader)
```

---

## Strategy 5: Risk Monitoring Dashboard

Run this daily to monitor portfolio risk:

```
Risk dashboard:
1. VIX level and trend — am I positioned for the right volatility regime?
2. Put/call ratio trend (30 days) — is sentiment getting extreme?
3. Treasury 10Y yield — what's the rate environment doing?
4. Fed funds rate — where are we in the cycle?
5. CPI trend (last 6 months, YoY) — is inflation re-accelerating?
6. Market indices — any major divergences (NASDAQ vs Dow)?
```

**Danger signals:**
- VIX > 25 + put/call ratio > 1.1 = market fear, tighten stops or hedge
- VIX < 13 + put/call ratio < 0.6 = extreme complacency, prepare for a volatility spike
- Rising CPI + rising fed funds = tightening cycle, risk-off for growth stocks

---

## Strategy 6: Contrarian Setups

Find stocks where sentiment is extreme but fundamentals tell a different story:

```
Find contrarian opportunities:
1. Scan for today's biggest losers (top 20)
2. For those with market cap > $10B, check:
   - RSI (is it near or below 30? = oversold)
   - Insider trades (any recent insider buying despite the drop?)
   - Analyst ratings (are analysts still bullish?)
   - Short interest (high short = squeeze potential on a bounce)
   - Company news (is the sell-off on news or just market sentiment?)
3. Flag any stock where: insiders are buying + analysts are bullish + RSI < 35
```

---

## Strategy 7: Options Income Screening

Find candidates for premium-selling strategies:

```
Screen for options income candidates:
1. Scan for stocks with market cap > $20B, average volume > 5M
2. For top results by volume, check:
   - Options implied move (higher = more premium)
   - Put/call ratio for the stock (elevated = put premium is rich)
   - Max pain (tells you where the stock gravitates to by expiration)
   - Technicals — is it range-bound? (ideal for selling premium)
   - Upcoming earnings or catalysts (avoid selling premium into events)
3. For the best candidates, show the put chain 5-10% below current price
```

---

## Strategy 8: Macro-to-Micro Flow

Start with the macro picture, then drill down to specific trades:

```
Top-down analysis:
1. MACRO: Fed funds rate, CPI trend, treasury yields, economic calendar
2. MARKET: Indices, VIX, put/call ratio, sector performance
3. SECTOR: Best and worst sectors today — why? (correlate with macro data)
4. STOCK: In the strongest sector, find the highest-volume breakout stock
5. ENTRY: For that stock — technicals, options implied move, max pain, analyst consensus
```

---

## Strategy 9: Crypto Macro Analysis

```
Full crypto macro picture:
1. Global crypto market cap and dominance (BTC + ETH)
2. Bitcoin quote + daily technicals
3. Ethereum quote + daily technicals
4. Top crypto gainers today
5. Trending coins on CoinGecko
6. Crypto news
7. Fed funds rate + treasury yields (crypto correlates inversely with rate expectations)
8. Compare: is BTC leading or lagging the NASDAQ?
```

---

## Strategy 10: Event-Driven Setup

For known catalysts (FOMC, CPI, earnings):

```
FOMC meeting is on [DATE]. Event setup:
1. Current fed funds rate and market expectations
2. VIX level — is event risk priced in?
3. Put/call ratio — how is the market positioned?
4. SPY options implied move for the FOMC week
5. Rate-sensitive sectors (XLU, XLRE, XLF) — how are they positioned?
6. Treasury 2Y and 10Y yields — what's the curve saying?
7. Historical: CPI and core PCE trends (the data the Fed watches)
```

---

## Pro Tips

### Combine Timeframes
Ask for technicals on multiple timeframes to find confluence:
```
Show me AAPL technicals on the 1h, daily, and weekly timeframes. Where do the signals agree?
```

### Cross-Reference Data Sources
When two tools cover similar data, use both for confirmation:
```
Get AAPL's earnings from both Alpha Vantage and Finnhub — do the numbers match?
```

### Use FRED for Context
Economic data adds critical context to any stock analysis:
```
I'm bullish on XLU (utilities). Show me the fed funds rate trajectory and
10Y yield trend — are falling rates supporting this thesis?
```

### Scan, Then Drill Down
Use scanners to find candidates, then deep-dive on the best ones:
```
1. First: scan for oversold stocks (RSI < 30, market cap > $5B)
2. Then: for the top 3 results, give me full analysis (technicals, fundamentals,
   insider trades, options flow, news)
```

### Track Changes Over Time
Use historical tools to spot trends:
```
Show me the CPI inflation rate (YoY) alongside the fed funds rate for all of 2025.
Is the Fed behind or ahead of inflation?
```
