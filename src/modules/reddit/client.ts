import { httpGet } from "../../shared/http.js";
import { TtlCache } from "../../shared/cache.js";

// ── Constants ────────────────────────────────────────────────────────────────

export const REDDIT_BASE = "https://www.reddit.com";

export const REDDIT_HEADERS: Record<string, string> = {
  "User-Agent": "stock-scanner-mcp/1.0 (by /u/stock-scanner-bot)",
};

export const DEFAULT_SUBREDDITS = [
  "wallstreetbets",
  "stocks",
  "investing",
  "options",
] as const;

// 5-minute TTL for trending tickers
export const trendingCache = new TtlCache<TrendingTicker[]>(5 * 60 * 1000);
// 2-minute TTL for mention/sentiment queries
export const mentionCache = new TtlCache<unknown>(2 * 60 * 1000);
// 5-minute TTL for watchlist scans (matches trendingCache freshness)
export const watchlistCache = new TtlCache<WatchlistScanResult>(5 * 60 * 1000);

// ── Stop words ───────────────────────────────────────────────────────────────

/** Common English words and finance acronyms that are NOT stock tickers */
export const STOP_WORDS = new Set([
  // 1-2 letter
  "I", "A", "AM", "AN", "AS", "AT", "BE", "BY", "DO", "GO", "HE", "IF",
  "IN", "IS", "IT", "ME", "MY", "NO", "OF", "OK", "ON", "OR", "SO", "TO",
  "UP", "US", "WE",
  // 3 letter common English
  "ALL", "AND", "ANY", "ARE", "BAD", "BIG", "BUT", "CAN", "DAY", "DID",
  "END", "FAR", "FEW", "FOR", "GET", "GOD", "GOT", "GUY", "HAS", "HAD",
  "HER", "HIM", "HIS", "HOW", "ITS", "JOB", "LET", "LOT", "MAN", "MAY",
  "MEN", "MOM", "NEW", "NOT", "NOW", "OLD", "ONE", "OUR", "OUT", "OWN",
  "PUT", "RAN", "RUN", "SAT", "SAY", "SET", "SHE", "SIT", "THE", "TOO",
  "TOP", "TRY", "TWO", "USE", "WAR", "WAS", "WAY", "WHO", "WHY", "WIN",
  "WON", "YES", "YET", "YOU",
  // 4 letter common English
  "ALSO", "BACK", "BEEN", "BEST", "BODY", "BOTH", "CALL", "CAME", "COME",
  "DARK", "DAYS", "DEAD", "DOES", "DONE", "DOWN", "EACH", "EVEN", "EVER",
  "EYES", "FACE", "FACT", "FEEL", "FIND", "FOUR", "FROM", "FULL", "GAVE",
  "GIVE", "GOOD", "HALF", "HAND", "HARD", "HAVE", "HEAD", "HEAR", "HELP",
  "HERE", "HIGH", "HOME", "HOPE", "IDEA", "INTO", "JUST", "KEEP", "KIND",
  "KNEW", "KNOW", "LAND", "LAST", "LEFT", "LESS", "LIFE", "LIKE", "LINE",
  "LIST", "LIVE", "LONG", "LOOK", "LOST", "LOVE", "MADE", "MAKE", "MANY",
  "MIND", "MORE", "MOST", "MUCH", "MUST", "NAME", "NEED", "NEWS", "NEXT",
  "NICE", "NONE", "ONCE", "ONLY", "OPEN", "OVER", "PAID", "PART", "PAST",
  "PLAN", "PLAY", "POST", "PULL", "PUSH", "RATE", "READ", "REAL", "REST",
  "RISK", "ROOM", "SAFE", "SAID", "SAME", "SEEN", "SHOW", "SIDE", "SOME",
  "SOON", "STOP", "SUCH", "SURE", "TAKE", "TALK", "TELL", "THAN", "THAT",
  "THEM", "THEN", "THEY", "THIS", "TIME", "TOOK", "TRUE", "TURN", "UPON",
  "VERY", "WANT", "WEEK", "WELL", "WENT", "WERE", "WHAT", "WHEN", "WILL",
  "WITH", "WORD", "WORK", "YEAR", "YOUR",
  // 5 letter common English
  "ABOUT", "AFTER", "AGAIN", "BEING", "BELOW", "BLACK", "BRING", "COULD",
  "EARLY", "EVERY", "FIRST", "GREAT", "GREEN", "HEARD", "HOUSE", "LARGE",
  "LATER", "LEARN", "LEVEL", "LIGHT", "MIGHT", "MONEY", "MONTH", "NEVER",
  "NIGHT", "OTHER", "PLACE", "POINT", "POWER", "PRICE", "RIGHT", "SHALL",
  "SINCE", "SMALL", "SORRY", "STAND", "START", "STATE", "STILL", "STUDY",
  "THEIR", "THERE", "THESE", "THING", "THINK", "THREE", "TODAY", "UNDER",
  "UNTIL", "WATER", "WHERE", "WHICH", "WHITE", "WHILE", "WHOLE", "WORLD",
  "WOULD", "WRITE", "YOUNG",
  // Finance acronyms that aren't tickers
  "ETF", "IPO", "SEC", "GDP", "FDA", "FED", "CEO", "CFO", "COO", "CTO",
  "ATH", "ATL", "EOD", "WSB", "OTC", "ITM", "OTM", "IMO", "LOL", "OMG",
  "USA", "NYSE", "YOLO", "FOMO", "HODL", "MOASS", "TLDR", "IMHO", "LMAO",
  "EDIT", "TLDR", "INFO", "HUGE", "GAIN", "HOLD", "SELL", "MOON",
  "CASH", "DEBT", "FUND", "BEAR", "BULL", "BOND", "LOAN", "LOSS",
  "PUMP", "DUMP", "LONG", "MAMA", "PAPA", "FREE", "ZERO", "PLUS",
]);

// ── Ticker extraction ────────────────────────────────────────────────────────

const CASHTAG_RE = /\$([A-Z]{2,5})\b/g;
const BARE_TICKER_RE = /\b([A-Z]{2,5})\b/g;

/**
 * Extract stock tickers from text using cashtag patterns and bare uppercase words.
 * Filters out common English words and finance acronyms.
 */
export function extractTickers(text: string): string[] {
  const tickers = new Set<string>();

  // 1. Cashtag matches (high confidence)
  let match: RegExpExecArray | null;
  CASHTAG_RE.lastIndex = 0;
  while ((match = CASHTAG_RE.exec(text)) !== null) {
    const ticker = match[1];
    if (!STOP_WORDS.has(ticker)) {
      tickers.add(ticker);
    }
  }

  // 2. Bare uppercase words (lower confidence, filtered by stop words)
  BARE_TICKER_RE.lastIndex = 0;
  while ((match = BARE_TICKER_RE.exec(text)) !== null) {
    const word = match[1];
    if (!STOP_WORDS.has(word)) {
      tickers.add(word);
    }
  }

  return [...tickers];
}

// ── Sentiment scoring ────────────────────────────────────────────────────────

const BULLISH_TERMS = [
  "bull", "calls", "long", "moon", "rocket", "tendies", "diamond hands",
  "buy", "buying", "bought", "dip", "undervalued", "breakout", "squeeze",
  "gamma", "rip", "printing", "lambo", "gains", "green", "upside",
];

const BEARISH_TERMS = [
  "bear", "puts", "short", "dump", "crash", "sell", "selling", "sold",
  "overvalued", "bubble", "bag", "bagholder", "red", "loss", "losses",
  "downside", "drill", "tank", "fade", "rug", "rekt", "worthless",
];

/**
 * Score text sentiment using keyword matching.
 * Returns positive for bullish, negative for bearish, 0 for neutral.
 */
export function scoreSentiment(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;

  for (const term of BULLISH_TERMS) {
    if (lower.includes(term)) score += 1;
  }
  for (const term of BEARISH_TERMS) {
    if (lower.includes(term)) score -= 1;
  }

  return score;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface RedditPost {
  title: string;
  selftext: string;
  score: number;
  numComments: number;
  createdUtc: number;
  permalink: string;
  subreddit: string;
}

interface RedditListingChild {
  data: {
    title: string;
    selftext: string;
    score: number;
    num_comments: number;
    created_utc: number;
    permalink: string;
    subreddit: string;
  };
}

interface RedditListing {
  data: {
    children: RedditListingChild[];
  };
}

export interface TrendingTicker {
  symbol: string;
  mentions: number;
  subreddits: Record<string, number>;
}

export interface TickerMentionResult {
  symbol: string;
  totalMentions: number;
  subreddits: Record<string, number>;
  topPosts: RedditPost[];
}

export interface TickerSentimentResult {
  symbol: string;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  averageScore: number;
  samplePosts: Array<RedditPost & { sentimentScore: number }>;
}

export interface WatchlistTickerResult {
  symbol: string;
  mentions: number;
  sentiment: { bullish: number; bearish: number; neutral: number; score: number };
  topPost: { title: string; score: number; subreddit: string } | null;
  hot: boolean;
}

export interface WatchlistScanResult {
  scanned: number;
  subredditsChecked: string[];
  requestsMade: number;
  tickers: WatchlistTickerResult[];
}

// ── Reddit API client ────────────────────────────────────────────────────────

export async function fetchSubredditPosts(
  subreddit: string,
  query: string,
  timeFilter: string,
  limit = 25,
): Promise<RedditPost[]> {
  const url = `${REDDIT_BASE}/r/${encodeURIComponent(subreddit)}/search.json?q=${encodeURIComponent(query)}&sort=new&restrict_sr=on&t=${encodeURIComponent(timeFilter)}&limit=${encodeURIComponent(String(limit))}`;

  const listing = await httpGet<RedditListing>(url, {
    headers: REDDIT_HEADERS,
  });

  return listing.data.children.map((child) => ({
    title: child.data.title,
    selftext: child.data.selftext,
    score: child.data.score,
    numComments: child.data.num_comments,
    createdUtc: child.data.created_utc,
    permalink: child.data.permalink,
    subreddit: child.data.subreddit,
  }));
}

// ── High-level functions ─────────────────────────────────────────────────────

export async function getTrendingTickers(
  subreddits: readonly string[] = DEFAULT_SUBREDDITS,
  limit = 20,
): Promise<TrendingTicker[]> {
  const cacheKey = `trending:${[...subreddits].sort().join(",")}:${limit}`;
  const cached = trendingCache.get(cacheKey);
  if (cached) return cached;

  const tickerMap = new Map<string, { mentions: number; subreddits: Record<string, number> }>();

  for (const sub of subreddits) {
    let posts: RedditPost[];
    try {
      posts = await fetchSubredditPosts(sub, "stocks OR market OR trading", "week");
    } catch {
      continue;
    }

    for (const post of posts) {
      const text = `${post.title} ${post.selftext}`;
      const tickers = extractTickers(text);
      for (const ticker of tickers) {
        const existing = tickerMap.get(ticker) ?? { mentions: 0, subreddits: {} };
        existing.mentions += 1;
        existing.subreddits[sub] = (existing.subreddits[sub] ?? 0) + 1;
        tickerMap.set(ticker, existing);
      }
    }
  }

  const result: TrendingTicker[] = [...tickerMap.entries()]
    .map(([symbol, data]) => ({ symbol, mentions: data.mentions, subreddits: data.subreddits }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, limit);

  trendingCache.set(cacheKey, result);
  return result;
}

export async function getTickerMentions(
  symbol: string,
  period = "week",
): Promise<TickerMentionResult> {
  const cacheKey = `mentions:${symbol}:${period}`;
  const cached = mentionCache.get(cacheKey);
  if (cached) return cached as TickerMentionResult;

  const subredditCounts: Record<string, number> = {};
  const allPosts: RedditPost[] = [];

  for (const sub of DEFAULT_SUBREDDITS) {
    let posts: RedditPost[];
    try {
      posts = await fetchSubredditPosts(sub, symbol, period);
    } catch {
      continue;
    }

    subredditCounts[sub] = posts.length;
    allPosts.push(...posts);
  }

  const topPosts = allPosts
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const result: TickerMentionResult = {
    symbol,
    totalMentions: allPosts.length,
    subreddits: subredditCounts,
    topPosts,
  };

  mentionCache.set(cacheKey, result);
  return result;
}

interface WatchlistAccumulator {
  mentions: number;
  bullish: number;
  bearish: number;
  neutral: number;
  scoreSum: number;
  topPost: { title: string; score: number; subreddit: string } | null;
}

// Batch size keeps each OR query well under Reddit's ~2000-char search URL cap:
// worst case with the schema's 10-char symbol limit is
// 20*10 + 19*len(" OR ") = 200 + 76 = 276 chars. If either constant or the
// schema's symbol cap changes, re-check this stays under the budget.
const WATCHLIST_BATCH_SIZE = 20;
const HOT_THRESHOLD = 5;

/**
 * Scan multiple watchlist tickers for Reddit activity in a single pass.
 *
 * Tickers are combined into one OR query per subreddit (batched in groups of
 * {@link WATCHLIST_BATCH_SIZE} to stay under Reddit's URL length limit), so a
 * scan costs `ceil(symbols/20) × DEFAULT_SUBREDDITS.length` requests instead of
 * one request per ticker. Subreddits within a batch are fetched in parallel.
 *
 * Attribution intersects {@link extractTickers} output with the input watchlist,
 * so only requested symbols are counted. Sentiment is scored per-post (not
 * per-ticker): a multi-ticker post applies the same score to each matched symbol.
 * Symbols that overlap STOP_WORDS or fall outside the 2–5 char extractor range
 * may report zero mentions even when discussed.
 */
export async function scanWatchlist(
  symbols: string[],
  period = "day",
): Promise<WatchlistScanResult> {
  const upperSymbols = symbols.map((s) => s.toUpperCase());
  const cacheKey = `watchlist:${[...upperSymbols].sort().join(",")}:${period}`;
  const cached = watchlistCache.get(cacheKey);
  if (cached) return cached;

  // Pre-initialise every input symbol so zero-mention tickers still appear.
  const tickerData = new Map<string, WatchlistAccumulator>();
  for (const sym of upperSymbols) {
    tickerData.set(sym, { mentions: 0, bullish: 0, bearish: 0, neutral: 0, scoreSum: 0, topPost: null });
  }

  // Batch symbols to keep each OR query under the URL length limit.
  const batches: string[][] = [];
  for (let i = 0; i < upperSymbols.length; i += WATCHLIST_BATCH_SIZE) {
    batches.push(upperSymbols.slice(i, i + WATCHLIST_BATCH_SIZE));
  }

  let requestsMade = 0;

  for (const batch of batches) {
    const orQuery = batch.join(" OR ");
    // Fetch all subreddits for this batch in parallel.
    const settled = await Promise.allSettled(
      DEFAULT_SUBREDDITS.map((sub) => fetchSubredditPosts(sub, orQuery, period, 100)),
    );

    for (const outcome of settled) {
      if (outcome.status !== "fulfilled") continue;
      requestsMade += 1;
      const posts = outcome.value;

      for (const post of posts) {
        const text = `${post.title} ${post.selftext}`;
        const matched = extractTickers(text).filter((t) => tickerData.has(t));
        if (matched.length === 0) continue;
        const sentScore = scoreSentiment(text);

        for (const sym of matched) {
          const acc = tickerData.get(sym)!;
          acc.mentions += 1;
          if (sentScore > 0) acc.bullish += 1;
          else if (sentScore < 0) acc.bearish += 1;
          else acc.neutral += 1;
          acc.scoreSum += sentScore;
          if (!acc.topPost || post.score > acc.topPost.score) {
            acc.topPost = { title: post.title, score: post.score, subreddit: post.subreddit };
          }
        }
      }
    }
  }

  const tickers: WatchlistTickerResult[] = upperSymbols
    .map((sym) => {
      const acc = tickerData.get(sym)!;
      const total = acc.bullish + acc.bearish + acc.neutral;
      return {
        symbol: sym,
        mentions: acc.mentions,
        sentiment: {
          bullish: acc.bullish,
          bearish: acc.bearish,
          neutral: acc.neutral,
          score: total > 0 ? Math.round((acc.scoreSum / total) * 100) / 100 : 0,
        },
        topPost: acc.topPost,
        hot: acc.mentions >= HOT_THRESHOLD,
      };
    })
    .sort((a, b) => b.mentions - a.mentions);

  const result: WatchlistScanResult = {
    scanned: upperSymbols.length,
    subredditsChecked: [...DEFAULT_SUBREDDITS],
    requestsMade,
    tickers,
  };

  watchlistCache.set(cacheKey, result);
  return result;
}

export async function getTickerSentiment(
  symbol: string,
  limit = 50,
): Promise<TickerSentimentResult> {
  const cacheKey = `sentiment:${symbol}:${limit}`;
  const cached = mentionCache.get(cacheKey);
  if (cached) return cached as TickerSentimentResult;

  const allPosts: RedditPost[] = [];

  for (const sub of DEFAULT_SUBREDDITS) {
    let posts: RedditPost[];
    try {
      posts = await fetchSubredditPosts(sub, symbol, "week", limit);
    } catch {
      continue;
    }
    allPosts.push(...posts);
  }

  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;
  let totalScore = 0;

  const scored = allPosts.map((post) => {
    const text = `${post.title} ${post.selftext}`;
    const sentimentScore = scoreSentiment(text);
    totalScore += sentimentScore;
    if (sentimentScore > 0) bullishCount += 1;
    else if (sentimentScore < 0) bearishCount += 1;
    else neutralCount += 1;
    return { ...post, sentimentScore };
  });

  const samplePosts = scored
    .sort((a, b) => Math.abs(b.sentimentScore) - Math.abs(a.sentimentScore))
    .slice(0, 10);

  const result: TickerSentimentResult = {
    symbol,
    bullishCount,
    bearishCount,
    neutralCount,
    averageScore: allPosts.length > 0 ? totalScore / allPosts.length : 0,
    samplePosts,
  };

  mentionCache.set(cacheKey, result);
  return result;
}
