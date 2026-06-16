---
name: reddit-watchlist-scan
status: revised-after-readiness-review
created: 2026-06-16T08:05:00Z
updated: 2026-06-16T08:55:00Z
issue: 197
module: reddit
review: docs/reviews/2026-06-16-reddit-watchlist-scan-plan-readiness.md
---

# Plan: `reddit_watchlist_scan` — batch Reddit sentiment for a watchlist

> **Revision note (round 2).** The first plan was rated **MISALIGNED** by the
> plan-readiness panel. This version fixes all 3 blockers and the major gaps:
> the HTTP sidecar route + OpenAPI, missing `.describe()`, the `max(20)`↔batching
> contradiction, the full set of count/doc sites, the `STOP_WORDS` attribution
> blind spot, the `>5`/`>=5` threshold conflict, NaN-on-zero-mentions, and the
> §12 new-tool checklist. See the review file for the full gap list.

## Spec (from issue #197)

Scanning a watchlist for Reddit sentiment today means calling `reddit_mentions` /
`reddit_sentiment` once per ticker — `N × 4` requests. Slow and rate-limited. We want
**one tool** that scans all watchlist tickers in a single pass by combining them into one
Reddit `OR` query per subreddit. Up to 20 tickers per query (URL-length limit); larger
watchlists batch into `ceil(N/20)` queries per subreddit. Then attribute mentions and
sentiment back to each input ticker.

### Acceptance criteria

- [ ] `reddit_watchlist_scan` tool added to the reddit module
- [ ] Combined `OR` query — `ceil(N/20) × 4` requests
- [ ] Per-ticker mention count, sentiment breakdown, top post, `hot` flag
- [ ] 5-minute TTL cache
- [ ] Unit tests with mocked `fetch` (aggregation, zero-mention, hot threshold, batching, ordering, input normalization, STOP_WORDS limitation, cache hit)
- [ ] **Sidecar REST route + OpenAPI** added (every reddit tool has one)
- [ ] **All count sites** updated (see "Counts & docs" — this is the part that breaks CI if missed)
- [ ] All quality gates pass (lint, test, validate-tools, build)

### Out of scope

The `workspace-morning-brief` skill update lives in user-side `.claude/skills/` config,
**not** in this repo.

## Grounding (verified in code)

| Building block | Location | Notes |
|---|---|---|
| `fetchSubredditPosts(subreddit, query, timeFilter, limit=25)` | `client.ts:194` | URL-encodes the query → pass `"A OR B"` (NOT `A+OR+B`). Sets `sort=new&restrict_sr=on`. |
| `extractTickers(text): string[]` | `client.ts:83` | Cashtag + bare-uppercase (`[A-Z]{2,5}`), **stop-word filtered**. See STOP_WORDS limitation below. |
| `scoreSentiment(text): number` | `client.ts:126` | `>0` bullish, `<0` bearish, `0` neutral. Per-post. |
| `DEFAULT_SUBREDDITS` | `client.ts:12` | `[wallstreetbets, stocks, investing, options]`. |
| `TtlCache<T>` | `shared/cache.ts` | `trendingCache` 5min, `mentionCache` 2min. |
| `RedditPost` | `client.ts:142` | `{ title, selftext, score, numComments, createdUtc, permalink, subreddit }`. |
| Tool shape | `index.ts:7` | `{ name, description, inputSchema, readOnly, handler }`; `withMetadata(fn,{source,dataDelay})`; `successResult(JSON.stringify(x,null,2))`. Every param uses `.describe()`. |
| Module tools | `index.ts:73` | `[trendingTool, mentionsTool, sentimentTool]` = 3. |
| Sidecar routes | `src/sidecar/routes.ts:151-153` | reddit has 3 GET routes. Array params use `transformParams: (p) => ({ x: p.get("x")?.split(",").map(s=>s.trim()).filter(Boolean) })` (see tradingview_quote at line ~15). |
| Per-module count | `registry.ts:27+` | each module has a literal `toolCount`; reddit's must go 3 → 4. |
| Test helpers | `__tests__/client.test.ts:5,33` | `makeRedditListing(posts)`, `mockFetchOk(data)` (`mockResolvedValueOnce`, one per request). Dynamic `import("../client.js")` after `vi.resetModules()`. |

---

## File 1 — `src/modules/reddit/client.ts` (~75 lines)

Interfaces `WatchlistTickerResult` / `WatchlistScanResult` (typed; no `any`). New
`watchlistCache = new TtlCache<WatchlistScanResult>(5*60*1000)`.

`scanWatchlist(symbols: string[], period = "day"): Promise<WatchlistScanResult>`:

- `upperSymbols = symbols.map(s => s.toUpperCase())` — **input normalization** (lowercase in → uppercase).
- cacheKey `watchlist:${[...upperSymbols].sort().join(",")}:${period}`; check cache first.
- **Pre-initialize `tickerData` for every input symbol** → zero-mention symbols still appear in output (`mentions:0`, `topPost:null`, `hot:false`).
- Batch into groups of 20: `for (i=0; i<n; i+=20)`.
- For each batch: `orQuery = batch.join(" OR ")`; **fetch the 4 subreddits in parallel** with `Promise.allSettled(DEFAULT_SUBREDDITS.map(sub => fetchSubredditPosts(sub, orQuery, period, 100)))` — fulfilled results count toward `requestsMade`, rejected ones are skipped (matches the spec's latency goal; sequential `for`-loop does not).
- Attribution: `matched = extractTickers(title+" "+selftext).filter(t => tickerData.has(t))`; skip post if none; `sentScore = scoreSentiment(text)`; per matched symbol accumulate `mentions`, bullish/bearish/neutral, `scoreSum`, and `topPost` (max `score`).
- `HOT_THRESHOLD = 5`; `hot = mentions >= HOT_THRESHOLD` (**"5 or more" — single source of truth; body, description, and tests all use `>=5`**).
- `score = total > 0 ? Math.round((scoreSum/total)*100)/100 : 0` (**guard avoids NaN** when `total === 0`).
- tickers sorted by `mentions` desc. Cache and return.

**Documented limitation — `STOP_WORDS` overlap.** `extractTickers` filters tokens in
`STOP_WORDS` (`client.ts:27-72`), which includes real tickers: `REAL, OPEN, HOLD, SELL,
FUND, BOND, BULL, BEAR, LONG, DUMP, MOON, CASH, DEBT, LOSS, PLUS, ZERO, FREE`, etc. Such a
watchlist symbol will report `mentions:0` even if discussed. This is a known constraint of
the shared extractor; also `extractTickers` only matches 2–5 char uppercase tokens, so
1-char and 6+-char symbols never match. We **document this in the tool description and test
it**, rather than fork the extractor (keeps one extraction path). (Optional future work: a
cashtag-exact fallback for watchlist symbols.)

---

## File 2 — `src/modules/reddit/index.ts` (~45 lines)

Import `scanWatchlist`. New `watchlistScanTool`:

- `inputSchema: z.object({ symbols: z.array(z.string().max(10)).min(1).max(50).describe("..."), period: z.enum(["hour","day","week"]).default("day").describe("...") })`
  - **Both params get `.describe()`** (validate-tools hard-fails otherwise).
  - **`.max(50)`, not 20** — so batching (`ceil(N/20)`) is actually reachable through the tool and not dead code. 50 symbols ≈ 3 batches × 4 = 12 requests; well under URL limits per 20-symbol batch.
- `description`: batch OR-query behavior, request math (`ceil(N/20)×4`), per-ticker mentions/sentiment/topPost/`hot` (≥5 mentions), "prefer over N× reddit_mentions/reddit_sentiment", and limitations: **keyword (not NLP), sentiment per-post not per-ticker, and symbols overlapping common words / outside 2–5 chars may under-report** (STOP_WORDS note).
- `readOnly: true`.
- `handler: withMetadata(async (args: { symbols: string[]; period?: string }) => successResult(JSON.stringify(await scanWatchlist(args.symbols, args.period ?? "day"), null, 2)), { source: "reddit", dataDelay: "real-time" })` — **explicit arg type**.

`tools: [trendingTool, mentionsTool, sentimentTool, watchlistScanTool]`.

---

## File 3 — `src/sidecar/routes.ts` (NEW — was missing in v1)

Add after the reddit block (line ~153):

```typescript
{
  method: "GET",
  path: "/reddit/watchlist-scan",
  tool: "reddit_watchlist_scan",
  transformParams: (p) => ({
    symbols: p.get("symbols")?.split(",").map((s) => s.trim()).filter(Boolean),
    period: p.get("period") || undefined,
  }),
},
```

Mirrors the tradingview array-param pattern. The OpenAPI spec is generated from this table
(`src/scripts/generate-sidecar-openapi*`), so adding the route is what makes the OpenAPI
test pass — **verify** `npm run` openapi generation / `generate-sidecar-openapi.test.ts`
after adding (it asserts a tool/route count, see Counts below).

---

## File 4 — `src/modules/reddit/__tests__/client.test.ts` (~120 lines)

`describe("scanWatchlist")`, reusing `makeRedditListing` + `mockFetchOk`. **One
`mockFetchOk` per HTTP request**; with parallel fetch, still 4 requests/batch — queue 4
mocks per call (8 for the 21-symbol test). Cases:

| Test | Asserts |
|---|---|
| Multi-ticker aggregation | 4 mocked subs, 2 watchlist tickers → `mentions`, sentiment counts, `topPost` = highest score |
| Input normalization | `scanWatchlist(["aapl"])` → result symbol `"AAPL"` (lowercase accepted) |
| Zero-mention ticker | symbol with no posts → `mentions:0`, `topPost:null`, `hot:false`, `sentiment.score:0` (no NaN) |
| `hot` threshold | ≥5 mentions → `hot:true`; 4 → `hot:false` |
| Batching | 21 symbols → `requestsMade === ceil(21/20)*4 === 8` (reachable: client fn, schema cap is 50) |
| Ordering | tickers sorted by `mentions` desc |
| Non-watchlist ignored | post mentions a non-input ticker → not in results |
| STOP_WORDS limitation | `scanWatchlist(["REAL"])` with a post saying "REAL is up" → `mentions:0` (documents the known constraint) |
| Cache hit | identical args 2nd call → no extra `fetch` |

Update the module-shape test (in the file that asserts `mod.tools` shape): tool count
`3 → 4`, add `"reddit_watchlist_scan"` to the expected names, and the all-tools-`readOnly`
assertion still holds. **(§12 step 7.)**

---

## File 5 — Counts, registry & integration tests (the CI-breakers)

**Before editing, run** `grep -rn "64\|54\|55" src/ README.md CLAUDE.md docs/` and update
every real count site. Known sites to reconcile (verify exact current value first — there
is a `54` vs `64` discrepancy between integration and openapi tests):

- `src/registry.ts` — reddit `toolCount: 3 → 4`.
- `src/__tests__/integration.test.ts:59,62,71` — `expect(totalTools).toBe(54)`, the `"all 54 tool names"` it-name, and `.toBe(54)` → bump by 1 **only if reddit is included in that sum** (read the test's module list first; update the inline comment math too). **(§12 step 8.)**
- `src/scripts/__tests__/generate-sidecar-openapi.test.ts:63` — `"contains all 64 tools"` → 65; line 75 `>= 55` stays valid (one more route).
- `src/index.ts:40` — banner `MODULES (64 tools total)` → 65.
- `CLAUDE.md` — header `64 tools total` → 65; reddit row "trending & sentiment" can mention watchlist scan.
- `README.md` — `64` appears in 5+ spots (heading/anchor, module table, totals) plus the Reddit tool list — update all; add `reddit_watchlist_scan` row.

(§13 discourages hardcoded counts, but the existing tests use them, so they must be updated
to stay green.)

---

## Quality gates → expert panel

```bash
npm run lint && npm test && npm run validate-tools && npm run build
```

Then the mandatory pre-PR review via the **expert-panel-review** skill on the diff (§14),
fix CRITICAL/MAJOR, re-gate, loop to approval. Then PR.

## Effort / risk

**~4–5h** (up from the v1 estimate — sidecar route, OpenAPI, and the count reconciliation
are real work, not just the client function). Low logic risk; the failure modes are all
"forgot a required site," which this revision enumerates.
