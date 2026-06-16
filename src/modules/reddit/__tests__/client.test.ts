import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Helper: build a Reddit listing response ──────────────────────────────────

function makeRedditListing(
  posts: Array<{
    title: string;
    selftext?: string;
    score?: number;
    num_comments?: number;
    created_utc?: number;
    permalink?: string;
    subreddit?: string;
  }>,
) {
  return {
    data: {
      children: posts.map((p) => ({
        data: {
          title: p.title,
          selftext: p.selftext ?? "",
          score: p.score ?? 1,
          num_comments: p.num_comments ?? 0,
          created_utc: p.created_utc ?? 1712500000,
          permalink: p.permalink ?? "/r/stocks/comments/abc123/test",
          subreddit: p.subreddit ?? "stocks",
        },
      })),
    },
  };
}

function mockFetchOk(data: unknown) {
  (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  });
}

function mockFetchError() {
  (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: false,
    status: 500,
    statusText: "Server Error",
    text: async () => "boom",
  });
}

// ── extractTickers ───────────────────────────────────────────────────────────

describe("extractTickers", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("extracts $TICKER cashtags", async () => {
    const { extractTickers } = await import("../client.js");
    expect(extractTickers("I like $AAPL and $TSLA")).toEqual(["AAPL", "TSLA"]);
  });

  it("extracts bare uppercase tickers", async () => {
    const { extractTickers } = await import("../client.js");
    const result = extractTickers("Check out NVDA and MSFT today");
    expect(result).toContain("NVDA");
    expect(result).toContain("MSFT");
  });

  it("ignores stop words", async () => {
    const { extractTickers } = await import("../client.js");
    const result = extractTickers("THE CEO OF SEC SAID ALL ETF ARE GOOD FOR USA");
    expect(result).toEqual([]);
  });

  it("handles empty and no-match text", async () => {
    const { extractTickers } = await import("../client.js");
    expect(extractTickers("")).toEqual([]);
    expect(extractTickers("no tickers here at all")).toEqual([]);
  });

  it("deduplicates tickers from cashtag and bare word", async () => {
    const { extractTickers } = await import("../client.js");
    const result = extractTickers("$AAPL is great, AAPL to the moon");
    expect(result).toEqual(["AAPL"]);
  });
});

// ── scoreSentiment ───────────────────────────────────────────────────────────

describe("scoreSentiment", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("scores bullish text positively", async () => {
    const { scoreSentiment } = await import("../client.js");
    expect(scoreSentiment("buying calls, moon rocket tendies!")).toBeGreaterThan(0);
  });

  it("scores bearish text negatively", async () => {
    const { scoreSentiment } = await import("../client.js");
    expect(scoreSentiment("selling puts, crash dump worthless")).toBeLessThan(0);
  });

  it("scores neutral text as zero", async () => {
    const { scoreSentiment } = await import("../client.js");
    expect(scoreSentiment("the stock traded sideways today")).toBe(0);
  });
});

// ── fetchSubredditPosts ──────────────────────────────────────────────────────

describe("fetchSubredditPosts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses Reddit listing data correctly", async () => {
    const listing = makeRedditListing([
      { title: "AAPL is going up", selftext: "I bought calls", score: 42, num_comments: 10, subreddit: "stocks" },
    ]);
    mockFetchOk(listing);

    const { fetchSubredditPosts } = await import("../client.js");
    const posts = await fetchSubredditPosts("stocks", "AAPL", "week");

    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe("AAPL is going up");
    expect(posts[0].selftext).toBe("I bought calls");
    expect(posts[0].score).toBe(42);
    expect(posts[0].numComments).toBe(10);
    expect(posts[0].subreddit).toBe("stocks");
    expect(posts[0]).toHaveProperty("createdUtc");
    expect(posts[0]).toHaveProperty("permalink");
  });

  it("sends correct URL with encoded query", async () => {
    mockFetchOk(makeRedditListing([]));

    const { fetchSubredditPosts } = await import("../client.js");
    await fetchSubredditPosts("wallstreetbets", "stocks OR market", "month", 10);

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("/r/wallstreetbets/search.json");
    expect(calledUrl).toContain("q=stocks%20OR%20market");
    expect(calledUrl).toContain("t=month");
    expect(calledUrl).toContain("limit=10");
    expect(calledUrl).toContain("restrict_sr=on");
    expect(calledUrl).toContain("sort=new");
  });

  it("sends User-Agent header", async () => {
    mockFetchOk(makeRedditListing([]));

    const { fetchSubredditPosts } = await import("../client.js");
    await fetchSubredditPosts("stocks", "AAPL", "week");

    const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = callArgs[1].headers;
    expect(headers["User-Agent"]).toContain("stock-scanner-mcp");
  });
});

// ── getTrendingTickers ───────────────────────────────────────────────────────

describe("getTrendingTickers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aggregates tickers from multiple subreddits and caches", async () => {
    const listing1 = makeRedditListing([
      { title: "$AAPL calls printing", subreddit: "wallstreetbets" },
      { title: "NVDA breakout incoming", subreddit: "wallstreetbets" },
    ]);
    const listing2 = makeRedditListing([
      { title: "$AAPL earnings report", subreddit: "stocks" },
    ]);

    mockFetchOk(listing1);
    mockFetchOk(listing2);

    const { getTrendingTickers } = await import("../client.js");
    const result = await getTrendingTickers(["wallstreetbets", "stocks"]);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const aapl = result.find((t) => t.symbol === "AAPL");
    expect(aapl).toBeDefined();
    expect(aapl!.mentions).toBeGreaterThanOrEqual(2);
    expect(aapl!.subreddits).toHaveProperty("wallstreetbets");
    expect(aapl!.subreddits).toHaveProperty("stocks");

    // Result is sorted by mentions descending
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].mentions).toBeGreaterThanOrEqual(result[i].mentions);
    }

    // Second call should use cache (no more fetch calls)
    const result2 = await getTrendingTickers(["wallstreetbets", "stocks"]);
    expect(result2).toEqual(result);
    expect(fetch).toHaveBeenCalledTimes(2); // only the initial 2 subreddit fetches
  });
});

// ── getTickerMentions ────────────────────────────────────────────────────────

describe("getTickerMentions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns correct mention shape with subreddit breakdown", async () => {
    // 4 subreddits = 4 fetch calls
    for (let i = 0; i < 4; i++) {
      mockFetchOk(makeRedditListing([
        { title: "AAPL discussion", score: 100 - i * 10, subreddit: ["wallstreetbets", "stocks", "investing", "options"][i] },
      ]));
    }

    const { getTickerMentions } = await import("../client.js");
    const result = await getTickerMentions("AAPL");

    expect(result.symbol).toBe("AAPL");
    expect(result.totalMentions).toBe(4);
    expect(Object.keys(result.subreddits)).toHaveLength(4);
    expect(result.topPosts.length).toBeLessThanOrEqual(10);
    // topPosts sorted by score descending
    expect(result.topPosts[0].score).toBeGreaterThanOrEqual(result.topPosts[result.topPosts.length - 1].score);
  });
});

// ── getTickerSentiment ───────────────────────────────────────────────────────

describe("getTickerSentiment", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns sentiment breakdown with correct counts", async () => {
    const bullishPost = { title: "AAPL buying calls moon rocket tendies", selftext: "diamond hands" };
    const bearishPost = { title: "AAPL crash dump sell puts", selftext: "overvalued" };
    const neutralPost = { title: "AAPL earnings report tomorrow", selftext: "" };

    // wallstreetbets
    mockFetchOk(makeRedditListing([bullishPost, bearishPost]));
    // stocks
    mockFetchOk(makeRedditListing([neutralPost]));
    // investing
    mockFetchOk(makeRedditListing([]));
    // options
    mockFetchOk(makeRedditListing([]));

    const { getTickerSentiment } = await import("../client.js");
    const result = await getTickerSentiment("AAPL");

    expect(result.symbol).toBe("AAPL");
    expect(result.bullishCount).toBe(1);
    expect(result.bearishCount).toBe(1);
    expect(result.neutralCount).toBe(1);
    expect(typeof result.averageScore).toBe("number");
    expect(result.samplePosts.length).toBeLessThanOrEqual(10);
    expect(result.samplePosts[0]).toHaveProperty("sentimentScore");
  });
});

// ── scanWatchlist ────────────────────────────────────────────────────────────

describe("scanWatchlist", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aggregates mentions and sentiment per watchlist ticker", async () => {
    // Subreddit order: wallstreetbets, stocks, investing, options
    mockFetchOk(makeRedditListing([
      { title: "$AAPL calls printing", score: 50, subreddit: "wallstreetbets" },
      { title: "NVDA breakout incoming", score: 30, subreddit: "wallstreetbets" },
    ]));
    mockFetchOk(makeRedditListing([
      { title: "$AAPL earnings report tomorrow", score: 80, subreddit: "stocks" },
    ]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));

    const { scanWatchlist } = await import("../client.js");
    const result = await scanWatchlist(["AAPL", "NVDA"]);

    expect(result.scanned).toBe(2);
    expect(result.requestsMade).toBe(4);
    expect(result.subredditsChecked).toEqual(["wallstreetbets", "stocks", "investing", "options"]);

    const aapl = result.tickers.find((t) => t.symbol === "AAPL")!;
    expect(aapl.mentions).toBe(2);
    expect(aapl.sentiment.bullish).toBe(1); // "calls printing"
    expect(aapl.sentiment.neutral).toBe(1); // "earnings report tomorrow"
    expect(aapl.topPost).toEqual({ title: "$AAPL earnings report tomorrow", score: 80, subreddit: "stocks" });

    const nvda = result.tickers.find((t) => t.symbol === "NVDA")!;
    expect(nvda.mentions).toBe(1);
    expect(nvda.sentiment.bullish).toBe(1); // "breakout"
  });

  it("normalizes lowercase input symbols to uppercase", async () => {
    mockFetchOk(makeRedditListing([{ title: "$AAPL calls", score: 10, subreddit: "wallstreetbets" }]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));

    const { scanWatchlist } = await import("../client.js");
    const result = await scanWatchlist(["aapl"]);

    expect(result.tickers).toHaveLength(1);
    expect(result.tickers[0].symbol).toBe("AAPL");
    expect(result.tickers[0].mentions).toBe(1);
  });

  it("includes zero-mention tickers without NaN scores", async () => {
    mockFetchOk(makeRedditListing([{ title: "$AAPL moon calls", score: 5, subreddit: "wallstreetbets" }]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));

    const { scanWatchlist } = await import("../client.js");
    const result = await scanWatchlist(["AAPL", "MSFT"]);

    const msft = result.tickers.find((t) => t.symbol === "MSFT")!;
    expect(msft.mentions).toBe(0);
    expect(msft.topPost).toBeNull();
    expect(msft.hot).toBe(false);
    expect(msft.sentiment.score).toBe(0);
    expect(Number.isNaN(msft.sentiment.score)).toBe(false);
  });

  it("flags a ticker as hot at 5 or more mentions", async () => {
    mockFetchOk(makeRedditListing(
      Array.from({ length: 5 }, (_, i) => ({ title: "$GME squeeze", score: i, subreddit: "wallstreetbets" })),
    ));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));

    const { scanWatchlist } = await import("../client.js");
    const result = await scanWatchlist(["GME"]);

    expect(result.tickers[0].mentions).toBe(5);
    expect(result.tickers[0].hot).toBe(true);
  });

  it("does not flag a ticker as hot below 5 mentions", async () => {
    mockFetchOk(makeRedditListing(
      Array.from({ length: 4 }, (_, i) => ({ title: "$AMC calls", score: i, subreddit: "wallstreetbets" })),
    ));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));

    const { scanWatchlist } = await import("../client.js");
    const result = await scanWatchlist(["AMC"]);

    expect(result.tickers[0].mentions).toBe(4);
    expect(result.tickers[0].hot).toBe(false);
  });

  it("batches >20 symbols into ceil(N/20) queries per subreddit", async () => {
    // 21 symbols → 2 batches × 4 subreddits = 8 requests
    for (let i = 0; i < 8; i++) mockFetchOk(makeRedditListing([]));

    const { scanWatchlist } = await import("../client.js");
    const symbols = Array.from({ length: 21 }, (_, i) => `TICKER${i}`);
    const result = await scanWatchlist(symbols);

    expect(result.scanned).toBe(21);
    expect(result.requestsMade).toBe(8);
    expect(fetch).toHaveBeenCalledTimes(8);
  });

  it("sorts tickers by mention count descending", async () => {
    mockFetchOk(makeRedditListing([
      { title: "$AAPL up", score: 1, subreddit: "wallstreetbets" },
      { title: "NVDA up NVDA again", score: 1, subreddit: "wallstreetbets" },
    ]));
    mockFetchOk(makeRedditListing([{ title: "NVDA third post", score: 1, subreddit: "stocks" }]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));

    const { scanWatchlist } = await import("../client.js");
    const result = await scanWatchlist(["AAPL", "NVDA"]);

    for (let i = 1; i < result.tickers.length; i++) {
      expect(result.tickers[i - 1].mentions).toBeGreaterThanOrEqual(result.tickers[i].mentions);
    }
    expect(result.tickers[0].symbol).toBe("NVDA");
  });

  it("ignores tickers that are not in the watchlist", async () => {
    mockFetchOk(makeRedditListing([{ title: "TSLA mooning hard", score: 99, subreddit: "wallstreetbets" }]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));

    const { scanWatchlist } = await import("../client.js");
    const result = await scanWatchlist(["AAPL"]);

    expect(result.tickers.map((t) => t.symbol)).toEqual(["AAPL"]);
    expect(result.tickers[0].mentions).toBe(0);
  });

  it("under-reports symbols that collide with STOP_WORDS (known limitation)", async () => {
    // "REAL" is in STOP_WORDS, so extractTickers never returns it.
    mockFetchOk(makeRedditListing([{ title: "REAL is up today", score: 10, subreddit: "wallstreetbets" }]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));

    const { scanWatchlist } = await import("../client.js");
    const result = await scanWatchlist(["REAL"]);

    expect(result.tickers[0].symbol).toBe("REAL");
    expect(result.tickers[0].mentions).toBe(0);
  });

  it("caches results for identical inputs", async () => {
    mockFetchOk(makeRedditListing([{ title: "$AAPL calls", score: 1, subreddit: "wallstreetbets" }]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));

    const { scanWatchlist } = await import("../client.js");
    const first = await scanWatchlist(["AAPL"]);
    const second = await scanWatchlist(["AAPL"]);

    expect(second).toEqual(first);
    expect(fetch).toHaveBeenCalledTimes(4); // no extra fetches on the cached call
  });

  it("skips a failed subreddit fetch without aborting the scan or counting it", async () => {
    // wallstreetbets fails; the other three succeed.
    mockFetchError();
    mockFetchOk(makeRedditListing([{ title: "$AAPL calls", score: 12, subreddit: "stocks" }]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));

    const { scanWatchlist } = await import("../client.js");
    const result = await scanWatchlist(["AAPL"]);

    // Only the 3 fulfilled fetches count; the rejected one is skipped.
    expect(result.requestsMade).toBe(3);
    // Aggregation from the successful subreddits still happens.
    expect(result.tickers[0].symbol).toBe("AAPL");
    expect(result.tickers[0].mentions).toBe(1);
    expect(result.tickers[0].topPost).toEqual({ title: "$AAPL calls", score: 12, subreddit: "stocks" });
  });

  it("forwards the period to the query and keys the cache by period", async () => {
    // First scan: period "week".
    mockFetchOk(makeRedditListing([])); mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([])); mockFetchOk(makeRedditListing([]));

    const { scanWatchlist } = await import("../client.js");
    await scanWatchlist(["AAPL"], "week");

    const weekUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(weekUrl).toContain("t=week");
    expect(fetch).toHaveBeenCalledTimes(4);

    // Different period must NOT be served from the "week" cache entry.
    mockFetchOk(makeRedditListing([])); mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([])); mockFetchOk(makeRedditListing([]));
    await scanWatchlist(["AAPL"], "day");

    expect(fetch).toHaveBeenCalledTimes(8); // fetched again, not cached
    const dayUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[4][0] as string;
    expect(dayUrl).toContain("t=day");
  });

  it("credits every matched ticker in a single multi-ticker post (per-post fan-out)", async () => {
    mockFetchOk(makeRedditListing([
      { title: "$AAPL and $NVDA both mooning calls", score: 42, subreddit: "wallstreetbets" },
    ]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));

    const { scanWatchlist } = await import("../client.js");
    const result = await scanWatchlist(["AAPL", "NVDA"]);

    const aapl = result.tickers.find((t) => t.symbol === "AAPL")!;
    const nvda = result.tickers.find((t) => t.symbol === "NVDA")!;
    // Both symbols get the single post's mention, the same (bullish) classification, and the same top post.
    expect(aapl.mentions).toBe(1);
    expect(nvda.mentions).toBe(1);
    expect(aapl.sentiment.bullish).toBe(1);
    expect(nvda.sentiment.bullish).toBe(1);
    expect(aapl.topPost).toEqual(nvda.topPost);
    expect(aapl.topPost).toEqual({ title: "$AAPL and $NVDA both mooning calls", score: 42, subreddit: "wallstreetbets" });
  });

  it("keeps the first-seen post on a topPost score tie (strict > tie-break)", async () => {
    // Two posts with identical scores; the first-encountered subreddit wins.
    mockFetchOk(makeRedditListing([{ title: "$AAPL first", score: 10, subreddit: "wallstreetbets" }]));
    mockFetchOk(makeRedditListing([{ title: "$AAPL second", score: 10, subreddit: "stocks" }]));
    mockFetchOk(makeRedditListing([]));
    mockFetchOk(makeRedditListing([]));

    const { scanWatchlist } = await import("../client.js");
    const result = await scanWatchlist(["AAPL"]);

    expect(result.tickers[0].mentions).toBe(2);
    expect(result.tickers[0].topPost).toEqual({ title: "$AAPL first", score: 10, subreddit: "wallstreetbets" });
  });
});

// ── createRedditModule ───────────────────────────────────────────────────────

describe("createRedditModule", () => {
  it("returns module with 4 tools and no required env vars", async () => {
    vi.resetModules();
    const { createRedditModule } = await import("../index.js");
    const mod = createRedditModule();
    expect(mod.name).toBe("reddit");
    expect(mod.requiredEnvVars).toEqual([]);
    expect(mod.tools).toHaveLength(4);
    expect(mod.tools.map((t) => t.name)).toEqual([
      "reddit_trending",
      "reddit_mentions",
      "reddit_sentiment",
      "reddit_watchlist_scan",
    ]);
  });

  it("all tools have readOnly: true", async () => {
    vi.resetModules();
    const { createRedditModule } = await import("../index.js");
    const mod = createRedditModule();
    for (const tool of mod.tools) {
      expect(tool.readOnly).toBe(true);
    }
  });
});
