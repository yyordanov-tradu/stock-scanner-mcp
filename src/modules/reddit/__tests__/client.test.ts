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
