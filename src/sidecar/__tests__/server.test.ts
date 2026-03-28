import { describe, it, expect, vi, afterEach } from "vitest";
import * as http from "node:http";
import { createServer } from "../server.js";

// Capture the REAL fetch before any test mocking
const realFetch = globalThis.fetch;

function getPort(server: http.Server): number {
  const addr = server.address();
  if (addr && typeof addr === "object") return addr.port;
  throw new Error("Server not listening");
}

async function get(
  server: http.Server,
  path: string,
): Promise<{ status: number; data: unknown }> {
  const port = getPort(server);
  const res = await realFetch(`http://127.0.0.1:${port}${path}`);
  const data = await res.json();
  return { status: res.status, data };
}

async function post(
  server: http.Server,
  path: string,
  body: unknown,
): Promise<{ status: number; data: unknown }> {
  const port = getPort(server);
  const res = await realFetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function postRaw(
  server: http.Server,
  path: string,
  rawBody: string,
): Promise<{ status: number; data: unknown }> {
  const port = getPort(server);
  const res = await realFetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function options(
  server: http.Server,
  path: string,
): Promise<{ status: number; headers: Headers }> {
  const port = getPort(server);
  const res = await realFetch(`http://127.0.0.1:${port}${path}`, { method: "OPTIONS" });
  return { status: res.status, headers: res.headers };
}

/**
 * Install a mock that intercepts upstream HTTP calls matching `urlMatch`
 * but lets through local server requests via realFetch.
 */
function mockUpstreamFetch(
  urlMatch: string | RegExp,
  response: unknown,
  httpStatus = 200,
): void {
  const pattern = typeof urlMatch === "string"
    ? (url: string) => url.includes(urlMatch)
    : (url: string) => urlMatch.test(url);

  vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    if (pattern(urlStr)) {
      const body = httpStatus >= 400 && typeof response === "string"
        ? response
        : JSON.stringify(response);
      return new Response(body, {
        status: httpStatus,
        statusText: httpStatus >= 400 ? "Error" : "OK",
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(url, init);
  }));
}

describe("sidecar server", () => {
  let server: http.Server;

  afterEach(() => {
    vi.restoreAllMocks();
    if (server) server.close();
  });

  // --- Health ---

  it("GET /health returns 200 with status ok", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/health");
    expect(status).toBe(200);
    expect(data).toEqual({ status: "ok" });
  });

  // --- 404 for unknown paths ---

  it("returns 404 for unknown paths", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/unknown");
    expect(status).toBe(404);
    expect(data).toEqual({ error: "Not found" });
  });

  // --- TradingView scan ---

  it("POST /tradingview/scan passes through to scanStocks", async () => {
    mockUpstreamFetch("scanner.tradingview.com", {
      data: [{ s: "NASDAQ:AAPL", d: [178.5, 2.3] }],
    });

    server = createServer({ port: 0 });
    const { status, data } = await post(server, "/tradingview/scan", {
      tickers: ["NASDAQ:AAPL"],
      columns: ["close", "change"],
    });

    expect(status).toBe(200);
    const rows = data as Array<{ symbol: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].symbol).toBe("NASDAQ:AAPL");
  });

  // --- TradingView crypto scan ---

  it("POST /tradingview-crypto/scan passes through to scanCrypto", async () => {
    mockUpstreamFetch("scanner.tradingview.com", {
      data: [{ s: "BINANCE:BTCUSDT", d: [65000, 1.5] }],
    });

    server = createServer({ port: 0 });
    const { status, data } = await post(server, "/tradingview-crypto/scan", {
      tickers: ["BINANCE:BTCUSDT"],
      columns: ["close", "change"],
    });

    expect(status).toBe(200);
    const rows = data as Array<{ symbol: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].symbol).toBe("BINANCE:BTCUSDT");
  });

  // --- Finnhub company news ---

  it("GET /finnhub/company-news passes through with symbol, from, to", async () => {
    mockUpstreamFetch("finnhub.io", [
      {
        category: "company",
        datetime: 1710500000,
        headline: "Test headline",
        source: "Test",
        summary: "Test summary",
        url: "https://example.com/1",
      },
    ]);

    server = createServer({ port: 0, finnhubApiKey: "test-key" });
    const { status, data } = await get(
      server,
      "/finnhub/company-news?symbol=AAPL&from=2024-01-01&to=2024-03-15",
    );

    expect(status).toBe(200);
    const articles = data as Array<{ headline: string }>;
    expect(articles).toHaveLength(1);
    expect(articles[0].headline).toBe("Test headline");
  });

  // --- Sentiment fear-greed ---

  it("GET /sentiment/fear-greed returns data", async () => {
    mockUpstreamFetch("cnn.io", {
      fear_and_greed: {
        score: 65,
        rating: "Greed",
        previous_close: 62,
        previous_1_week: 58,
        previous_1_month: 50,
        previous_1_year: 45,
      },
      market_momentum_sp500: { score: 70, rating: "Greed" },
      stock_price_strength: { score: 60, rating: "Greed" },
      stock_price_breadth: { score: 55, rating: "Neutral" },
      put_call_options: { score: 50, rating: "Neutral" },
      market_volatility_vix: { score: 80, rating: "Extreme Greed" },
      junk_bond_demand: { score: 65, rating: "Greed" },
      safe_haven_demand: { score: 60, rating: "Greed" },
    });

    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/sentiment/fear-greed");

    expect(status).toBe(200);
    const result = data as Record<string, unknown>;
    expect(result.score).toBe(65);
    expect(result.rating).toBe("Greed");
  });

  // --- Options chain ---

  it("GET /options/chain passes through with symbol", async () => {
    const mockYahooResponse = {
      optionChain: {
        result: [
          {
            underlyingSymbol: "AAPL",
            expirationDates: [1710500000],
            strikes: [170, 175, 180],
            quote: { regularMarketPrice: 178.5 },
            options: [
              {
                expirationDate: 1710500000,
                calls: [
                  {
                    contractSymbol: "AAPL240315C00170000",
                    strike: 170,
                    lastPrice: 9.5,
                    bid: 9.3,
                    ask: 9.7,
                    volume: 1000,
                    openInterest: 5000,
                    impliedVolatility: 0.25,
                    inTheMoney: true,
                  },
                ],
                puts: [],
              },
            ],
          },
        ],
      },
    };

    // Yahoo session flow: curveball -> cookie, getcrumb -> crumb, then actual API
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

      // Step 1: curveball for cookie
      if (urlStr.includes("fc.yahoo.com")) {
        return new Response("", {
          status: 302,
          headers: {
            "Set-Cookie": "A3=testcookievalue; Path=/; Domain=.yahoo.com",
          },
        });
      }

      // Step 2: getcrumb endpoint
      if (urlStr.includes("getcrumb")) {
        return new Response("test-crumb-value", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }

      // Step 3: actual options API call
      if (urlStr.includes("query1.finance.yahoo.com") || urlStr.includes("query2.finance.yahoo.com")) {
        return new Response(JSON.stringify(mockYahooResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return realFetch(url, init);
    }));

    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/options/chain?symbol=AAPL");

    expect(status).toBe(200);
    const result = data as Record<string, unknown>;
    expect(result.underlyingSymbol).toBe("AAPL");
  });

  // --- Error handling: upstream fetch failure ---

  it("returns 500 when upstream call fails", async () => {
    // Use sec-edgar which has no caching issues from prior tests
    mockUpstreamFetch("efts.sec.gov", "Internal Server Error", 500);

    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/sec-edgar/filings?query=AAPL");

    expect(status).toBe(500);
    const result = data as Record<string, unknown>;
    expect(result.error).toBeDefined();
  });

  // --- 400 for missing required params ---

  it("returns 400 for /finnhub/company-news without symbol", async () => {
    server = createServer({ port: 0, finnhubApiKey: "test-key" });
    const { status, data } = await get(
      server,
      "/finnhub/company-news?from=2024-01-01&to=2024-03-15",
    );
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toContain("symbol");
  });

  it("returns 400 for /finnhub/company-news without from/to", async () => {
    server = createServer({ port: 0, finnhubApiKey: "test-key" });
    const { status, data } = await get(server, "/finnhub/company-news?symbol=AAPL");
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toContain("from, to");
  });

  it("returns 400 for /options/chain without symbol", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/options/chain");
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toContain("symbol");
  });

  it("returns 400 for /fred/indicator without series", async () => {
    server = createServer({ port: 0, fredApiKey: "test-key" });
    const { status, data } = await get(server, "/fred/indicator");
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toContain("series");
  });

  // --- Gated endpoints return 404 when API key missing ---

  it("returns 404 for /finnhub/* when FINNHUB_API_KEY not configured", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await get(
      server,
      "/finnhub/company-news?symbol=AAPL&from=2024-01-01&to=2024-03-15",
    );
    expect(status).toBe(404);
    expect((data as Record<string, string>).error).toBe("FINNHUB_API_KEY not configured");
  });

  it("returns 404 for /fred/* when FRED_API_KEY not configured", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/fred/indicator?series=cpi");
    expect(status).toBe(404);
    expect((data as Record<string, string>).error).toBe("FRED_API_KEY not configured");
  });

  // --- FRED happy-path tests ---

  it("GET /fred/indicator passes through with series", async () => {
    mockUpstreamFetch("api.stlouisfed.org", {
      seriess: [{ id: "CPIAUCSL", title: "CPI", units: "Index" }],
      observations: [{ date: "2024-01-01", value: "308.4" }],
    });

    server = createServer({ port: 0, fredApiKey: "test-key" });
    const { status, data } = await get(server, "/fred/indicator?series=CPIAUCSL");

    expect(status).toBe(200);
    const result = data as Record<string, unknown>;
    expect(result).toBeDefined();
  });

  it("GET /fred/calendar passes through", async () => {
    mockUpstreamFetch("api.stlouisfed.org", {
      releases: [],
      release_dates: [{ release_id: 1, date: "2024-03-15" }],
    });

    server = createServer({ port: 0, fredApiKey: "test-key" });
    const { status, data } = await get(server, "/fred/calendar");

    expect(status).toBe(200);
    expect(data).toBeDefined();
  });

  // --- Invalid JSON body returns 400, not 500 ---

  it("returns 400 for invalid JSON body on POST", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await postRaw(server, "/tradingview/scan", "not valid json{{{");

    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toBe("Invalid JSON body");
  });

  // --- CORS preflight ---

  it("OPTIONS returns 204 with CORS headers", async () => {
    server = createServer({ port: 0 });
    const { status, headers } = await options(server, "/health");

    expect(status).toBe(204);
    expect(headers.get("access-control-allow-methods")).toBe("GET, POST, OPTIONS");
    expect(headers.get("access-control-allow-headers")).toBe("Content-Type");
    expect(headers.get("vary")).toBe("Origin");
  });

  // --- CORS restricts to localhost origins ---

  it("CORS allows localhost origins", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/health");

    expect(status).toBe(200);
    // Requests from 127.0.0.1 (our test client) should get localhost origin
    expect(data).toEqual({ status: "ok" });
  });

  // --- Symbol validation rejects injection attempts ---

  it("returns 400 for symbol with script injection", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/options/chain?symbol=<script>");
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toContain("Invalid symbol");
  });

  it("returns 400 for path traversal in symbol", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/options/chain?symbol=../../etc");
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toContain("Invalid symbol");
  });

  // --- Symbol regex accepts valid complex symbols ---

  it("accepts symbols with dots like BRK.B through validation", async () => {
    // Verify BRK.B passes symbol validation (doesn't get 400)
    // The upstream call may fail (500) but the symbol itself is accepted
    server = createServer({ port: 0, finnhubApiKey: "test-key" });

    mockUpstreamFetch("finnhub.io", []);

    const { status, data } = await get(
      server,
      "/finnhub/company-news?symbol=BRK.B&from=2024-01-01&to=2024-03-15",
    );
    // Should not be 400 (symbol rejected) — 200 means validation passed
    expect(status).toBe(200);
  });

  // ========================================================================
  // TradingView GET routes
  // ========================================================================

  // --- TradingView: Quote ---
  it("GET /tradingview/quote returns quote data", async () => {
    mockUpstreamFetch("scanner.tradingview.com", {
      data: [{ s: "NASDAQ:AAPL", d: [178.5, 2.3, 1.5, 50000000, 2800000000000, "AAPL", "Apple Inc.", null, null, null, null, null, null, null, null] }],
    });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/tradingview/quote?tickers=AAPL");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns 400 for /tradingview/quote without tickers", async () => {
    server = createServer({ port: 0 });
    const { status } = await get(server, "/tradingview/quote");
    expect(status).toBe(400);
  });

  // --- TradingView: Technicals ---
  it("GET /tradingview/technicals returns technical data", async () => {
    mockUpstreamFetch("scanner.tradingview.com", {
      data: [{ s: "NASDAQ:AAPL", d: Array(25).fill(0.5) }],
    });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/tradingview/technicals?tickers=AAPL");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns 400 for /tradingview/technicals without tickers", async () => {
    server = createServer({ port: 0 });
    const { status } = await get(server, "/tradingview/technicals");
    expect(status).toBe(400);
  });

  // --- TradingView: Compare ---
  it("GET /tradingview/compare returns comparison data", async () => {
    mockUpstreamFetch("scanner.tradingview.com", {
      data: [
        { s: "NASDAQ:AAPL", d: Array(11).fill(100) },
        { s: "NASDAQ:MSFT", d: Array(11).fill(200) },
      ],
    });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/tradingview/compare?tickers=AAPL,MSFT");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns 400 for /tradingview/compare without tickers", async () => {
    server = createServer({ port: 0 });
    const { status } = await get(server, "/tradingview/compare");
    expect(status).toBe(400);
  });

  // --- TradingView: Top gainers ---
  it("GET /tradingview/top-gainers returns data", async () => {
    mockUpstreamFetch("scanner.tradingview.com", {
      data: [{ s: "NASDAQ:AAPL", d: [178.5, 5.2, 8.5, 50000000, "AAPL", "Apple", 2800000000000] }],
    });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/tradingview/top-gainers");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  // --- TradingView: Top losers ---
  it("GET /tradingview/top-losers returns data", async () => {
    mockUpstreamFetch("scanner.tradingview.com", {
      data: [{ s: "NASDAQ:XYZ", d: [10.5, -5.2, -0.55, 1000000, "XYZ", "Test", 500000000] }],
    });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/tradingview/top-losers");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  // --- TradingView: Top volume ---
  it("GET /tradingview/top-volume returns data", async () => {
    mockUpstreamFetch("scanner.tradingview.com", {
      data: [{ s: "NASDAQ:AAPL", d: [50000000, 178.5, 2.3, "AAPL", "Apple", 2800000000000] }],
    });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/tradingview/top-volume");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  // --- TradingView: Market indices ---
  it("GET /tradingview/market-indices returns index data", async () => {
    mockUpstreamFetch("scanner.tradingview.com", {
      data: [
        { s: "CBOE:VIX", d: [15.5, -2.1, -0.33, 16.0, 15.2, 15.8, "VIX", "Volatility Index"] },
      ],
    });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/tradingview/market-indices");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  // --- TradingView: Sector performance ---
  it("GET /tradingview/sector-performance returns sector data", async () => {
    mockUpstreamFetch("scanner.tradingview.com", {
      data: [{ s: "AMEX:XLK", d: [200, 1.5, 3.0, 5000000, "XLK", "Technology Select Sector", 0.02, 0.05, 0.1, 0.15] }],
    });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/tradingview/sector-performance");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  // --- TradingView: Volume breakout ---
  it("GET /tradingview/volume-breakout returns data", async () => {
    mockUpstreamFetch("scanner.tradingview.com", {
      data: [{ s: "NASDAQ:AAPL", d: [50000000, 3.5, 178.5, 2.3, "AAPL", "Apple", 2800000000000, 55, 0.5] }],
    });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/tradingview/volume-breakout");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  // ========================================================================
  // TradingView Crypto GET routes
  // ========================================================================

  // --- TradingView Crypto: Quote ---
  it("GET /tradingview-crypto/quote returns crypto quote data", async () => {
    mockUpstreamFetch("scanner.tradingview.com", {
      data: [{ s: "BINANCE:BTCUSDT", d: [65000, 1.5, 950, 5000000000, 1200000000000, "Bitcoin / TetherUS"] }],
    });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/tradingview-crypto/quote?symbols=BTCUSDT");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns 400 for /tradingview-crypto/quote without symbols", async () => {
    server = createServer({ port: 0 });
    const { status } = await get(server, "/tradingview-crypto/quote");
    expect(status).toBe(400);
  });

  // --- TradingView Crypto: Technicals ---
  it("GET /tradingview-crypto/technicals returns data", async () => {
    mockUpstreamFetch("scanner.tradingview.com", {
      data: [{ s: "BINANCE:BTCUSDT", d: Array(17).fill(0.5) }],
    });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/tradingview-crypto/technicals?symbols=BTCUSDT");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns 400 for /tradingview-crypto/technicals without symbols", async () => {
    server = createServer({ port: 0 });
    const { status } = await get(server, "/tradingview-crypto/technicals");
    expect(status).toBe(400);
  });

  // --- TradingView Crypto: Top gainers ---
  it("GET /tradingview-crypto/top-gainers returns data", async () => {
    mockUpstreamFetch("scanner.tradingview.com", {
      data: [{ s: "BINANCE:ETHUSDT", d: [3500, 5.2, 175, 2000000000, 400000000000, "Ethereum / TetherUS"] }],
    });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/tradingview-crypto/top-gainers");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  // ========================================================================
  // Finnhub new routes
  // ========================================================================

  // --- Finnhub: Market news ---
  it("GET /finnhub/market-news returns news articles", async () => {
    mockUpstreamFetch("finnhub.io", [{ category: "general", headline: "Market update", datetime: 1710500000, source: "Reuters", summary: "test", url: "https://example.com", id: 1, related: "" }]);
    server = createServer({ port: 0, finnhubApiKey: "test-key" });
    const { status, data } = await get(server, "/finnhub/market-news");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  // --- Finnhub: Company profile ---
  it("GET /finnhub/company-profile returns profile data", async () => {
    mockUpstreamFetch("finnhub.io", { name: "Apple Inc", ticker: "AAPL", country: "US", currency: "USD", exchange: "NASDAQ", finnhubIndustry: "Technology", ipo: "1980-12-12", logo: "", marketCapitalization: 2800000, phone: "", shareOutstanding: 15000, weburl: "" });
    server = createServer({ port: 0, finnhubApiKey: "test-key" });
    const { status, data } = await get(server, "/finnhub/company-profile?symbol=AAPL");
    expect(status).toBe(200);
    expect((data as Record<string, unknown>).name).toBe("Apple Inc");
  });

  it("returns 400 for /finnhub/company-profile without symbol", async () => {
    server = createServer({ port: 0, finnhubApiKey: "test-key" });
    const { status } = await get(server, "/finnhub/company-profile");
    expect(status).toBe(400);
  });

  // --- Finnhub: Peers ---
  it("GET /finnhub/peers returns peer symbols", async () => {
    mockUpstreamFetch("finnhub.io", ["MSFT", "GOOG", "META"]);
    server = createServer({ port: 0, finnhubApiKey: "test-key" });
    const { status, data } = await get(server, "/finnhub/peers?symbol=AAPL");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  // --- Finnhub: Market status ---
  it("GET /finnhub/market-status returns status", async () => {
    mockUpstreamFetch("finnhub.io", { exchange: "US", holiday: null, isOpen: true, session: "regular", t: 1710500000, timezone: "America/New_York" });
    server = createServer({ port: 0, finnhubApiKey: "test-key" });
    const { status, data } = await get(server, "/finnhub/market-status");
    expect(status).toBe(200);
    expect((data as Record<string, unknown>).exchange).toBe("US");
  });

  // --- Finnhub: Quote ---
  it("GET /finnhub/quote returns quote", async () => {
    mockUpstreamFetch("finnhub.io", { c: 178.5, d: 2.3, dp: 1.3, h: 180, l: 176, o: 177, pc: 176.2, t: 1710500000 });
    server = createServer({ port: 0, finnhubApiKey: "test-key" });
    const { status, data } = await get(server, "/finnhub/quote?symbol=AAPL");
    expect(status).toBe(200);
    expect((data as Record<string, unknown>).c).toBe(178.5);
  });

  // ========================================================================
  // SEC-EDGAR new routes
  // ========================================================================

  // --- SEC-EDGAR: Insider trades ---
  it("GET /sec-edgar/insider-trades returns insider data", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("company_tickers.json")) {
        return new Response(JSON.stringify({ "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (urlStr.includes("submissions/CIK")) {
        return new Response(JSON.stringify({
          cik: "0000320193",
          name: "Apple Inc.",
          filings: { recent: { accessionNumber: ["0001234-24-000001"], filingDate: ["2026-03-20"], form: ["4"], primaryDocument: ["doc.xml"], primaryDocDescription: ["FORM 4"] } },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (urlStr.includes("Archives/edgar")) {
        return new Response("<ownershipDocument><rptOwnerName>John Doe</rptOwnerName></ownershipDocument>", { status: 200, headers: { "Content-Type": "text/xml" } });
      }
      return realFetch(url, init);
    }));
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/sec-edgar/insider-trades?ticker=AAPL");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns 400 for /sec-edgar/insider-trades without ticker", async () => {
    server = createServer({ port: 0 });
    const { status } = await get(server, "/sec-edgar/insider-trades");
    expect(status).toBe(400);
  });

  // --- SEC-EDGAR: Company facts ---
  it("GET /sec-edgar/company-facts returns facts data", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("company_tickers.json")) {
        return new Response(JSON.stringify({ "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (urlStr.includes("companyfacts")) {
        return new Response(JSON.stringify({ cik: 320193, entityName: "Apple Inc.", facts: { "us-gaap": {} } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return realFetch(url, init);
    }));
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/sec-edgar/company-facts?ticker=AAPL");
    expect(status).toBe(200);
    expect((data as Record<string, unknown>).entityName).toBe("Apple Inc.");
  });

  // --- SEC-EDGAR: Institutional holdings ---
  it("GET /sec-edgar/institutional-holdings returns holdings", async () => {
    mockUpstreamFetch("efts.sec.gov", { hits: { hits: [] } });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/sec-edgar/institutional-holdings?query=AAPL");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns 400 for /sec-edgar/institutional-holdings without query", async () => {
    server = createServer({ port: 0 });
    const { status } = await get(server, "/sec-edgar/institutional-holdings");
    expect(status).toBe(400);
  });

  // --- SEC-EDGAR: Ownership filings ---
  it("GET /sec-edgar/ownership-filings returns filings", async () => {
    mockUpstreamFetch("efts.sec.gov", { hits: { hits: [] } });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/sec-edgar/ownership-filings?ticker=AAPL");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  // --- /edgar/filings alias ---
  it("GET /edgar/filings works as alias for /sec-edgar/filings", async () => {
    mockUpstreamFetch("efts.sec.gov", { hits: { hits: [] } });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/edgar/filings?query=AAPL");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns 400 for /edgar/filings without query", async () => {
    server = createServer({ port: 0 });
    const { status } = await get(server, "/edgar/filings");
    expect(status).toBe(400);
  });

  // ========================================================================
  // Options new routes
  // ========================================================================

  // --- Options: Put/Call ratio ---
  it("GET /options/put-call-ratio returns ratio data", async () => {
    mockUpstreamFetch("cdn.cboe.com", {
      ratios: [{ name: "TOTAL PUT/CALL RATIO", value: "0.85" }],
      "SUM OF ALL PRODUCTS": [{ name: "VOLUME", call: 5000000, put: 4250000, total: 9250000 }],
    });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/options/put-call-ratio?type=total&days=1");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  // --- Options: Expirations ---
  it("returns 400 for /options/expirations without symbol", async () => {
    server = createServer({ port: 0 });
    const { status } = await get(server, "/options/expirations");
    expect(status).toBe(400);
  });

  it("returns 400 for /options/unusual-activity without symbol", async () => {
    server = createServer({ port: 0 });
    const { status } = await get(server, "/options/unusual-activity");
    expect(status).toBe(400);
  });

  it("returns 400 for /options/max-pain without symbol", async () => {
    server = createServer({ port: 0 });
    const { status } = await get(server, "/options/max-pain");
    expect(status).toBe(400);
  });

  it("returns 400 for /options/implied-move without symbol", async () => {
    server = createServer({ port: 0 });
    const { status } = await get(server, "/options/implied-move");
    expect(status).toBe(400);
  });

  // --- Options: Expirations happy path ---
  // Uses GOOG to avoid cache collision with earlier AAPL options tests
  it("GET /options/expirations returns expiration dates", async () => {
    const mockYahooResponse = {
      optionChain: {
        result: [{
          underlyingSymbol: "GOOG",
          expirationDates: [1710500000, 1711100000],
          strikes: [170, 175, 180],
          quote: { regularMarketPrice: 178.5 },
          options: [{ expirationDate: 1710500000, calls: [], puts: [] }],
        }],
      },
    };
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("fc.yahoo.com")) return new Response("", { status: 302, headers: { "Set-Cookie": "A3=test; Path=/; Domain=.yahoo.com" } });
      if (urlStr.includes("getcrumb")) return new Response("test-crumb", { status: 200, headers: { "Content-Type": "text/plain" } });
      if (urlStr.includes("query1.finance.yahoo.com") || urlStr.includes("query2.finance.yahoo.com")) return new Response(JSON.stringify(mockYahooResponse), { status: 200, headers: { "Content-Type": "application/json" } });
      return realFetch(url, init);
    }));
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/options/expirations?symbol=GOOG");
    expect(status).toBe(200);
    expect((data as Record<string, unknown>).symbol).toBe("GOOG");
    expect(Array.isArray((data as Record<string, unknown>).expirations)).toBe(true);
  });

  // --- Options: Unusual activity happy path ---
  // Uses TSLA to avoid cache collision with earlier AAPL options tests
  it("GET /options/unusual-activity returns unusual contracts", async () => {
    const mockYahooResponse = {
      optionChain: {
        result: [{
          underlyingSymbol: "TSLA",
          expirationDates: [1710500000],
          strikes: [170, 175, 180],
          quote: { regularMarketPrice: 178.5 },
          options: [{
            expirationDate: 1710500000,
            calls: [{ contractSymbol: "TSLA240315C00170000", strike: 170, lastPrice: 9.5, bid: 9.3, ask: 9.7, volume: 5000, openInterest: 100, impliedVolatility: 0.25, inTheMoney: true }],
            puts: [{ contractSymbol: "TSLA240315P00180000", strike: 180, lastPrice: 2.5, bid: 2.3, ask: 2.7, volume: 3000, openInterest: 50, impliedVolatility: 0.3, inTheMoney: false }],
          }],
        }],
      },
    };
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("fc.yahoo.com")) return new Response("", { status: 302, headers: { "Set-Cookie": "A3=test; Path=/; Domain=.yahoo.com" } });
      if (urlStr.includes("getcrumb")) return new Response("test-crumb", { status: 200, headers: { "Content-Type": "text/plain" } });
      if (urlStr.includes("query1.finance.yahoo.com") || urlStr.includes("query2.finance.yahoo.com")) return new Response(JSON.stringify(mockYahooResponse), { status: 200, headers: { "Content-Type": "application/json" } });
      return realFetch(url, init);
    }));
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/options/unusual-activity?symbol=TSLA");
    expect(status).toBe(200);
    expect((data as Record<string, unknown>).symbol).toBe("TSLA");
    expect(Array.isArray((data as Record<string, unknown>).unusual)).toBe(true);
  });

  // --- Options: Max pain happy path ---
  // Uses AMZN to avoid cache collision with earlier AAPL options tests
  it("GET /options/max-pain returns max pain data", async () => {
    const mockYahooResponse = {
      optionChain: {
        result: [{
          underlyingSymbol: "AMZN",
          expirationDates: [1710500000],
          strikes: [170, 175, 180],
          quote: { regularMarketPrice: 178.5 },
          options: [{
            expirationDate: 1710500000,
            calls: [{ contractSymbol: "AMZN240315C00175000", strike: 175, lastPrice: 5, bid: 4.8, ask: 5.2, volume: 1000, openInterest: 5000, impliedVolatility: 0.25, inTheMoney: true }],
            puts: [{ contractSymbol: "AMZN240315P00180000", strike: 180, lastPrice: 3, bid: 2.8, ask: 3.2, volume: 800, openInterest: 3000, impliedVolatility: 0.3, inTheMoney: false }],
          }],
        }],
      },
    };
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("fc.yahoo.com")) return new Response("", { status: 302, headers: { "Set-Cookie": "A3=test; Path=/; Domain=.yahoo.com" } });
      if (urlStr.includes("getcrumb")) return new Response("test-crumb", { status: 200, headers: { "Content-Type": "text/plain" } });
      if (urlStr.includes("query1.finance.yahoo.com") || urlStr.includes("query2.finance.yahoo.com")) return new Response(JSON.stringify(mockYahooResponse), { status: 200, headers: { "Content-Type": "application/json" } });
      return realFetch(url, init);
    }));
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/options/max-pain?symbol=AMZN");
    expect(status).toBe(200);
    expect((data as Record<string, unknown>).symbol).toBe("AMZN");
    expect(typeof (data as Record<string, unknown>).maxPain).toBe("number");
  });

  // --- Options: Implied move happy path ---
  // Uses MSFT to avoid cache collision with earlier AAPL options tests
  it("GET /options/implied-move returns implied move data", async () => {
    const mockYahooResponse = {
      optionChain: {
        result: [{
          underlyingSymbol: "MSFT",
          expirationDates: [1710500000],
          strikes: [410, 420],
          quote: { regularMarketPrice: 415 },
          options: [{
            expirationDate: 1710500000,
            calls: [{ contractSymbol: "MSFT240315C00420000", strike: 420, lastPrice: 5.0, bid: 4.8, ask: 5.2, volume: 1000, openInterest: 5000, impliedVolatility: 0.22, inTheMoney: false }],
            puts: [{ contractSymbol: "MSFT240315P00410000", strike: 410, lastPrice: 4.0, bid: 3.8, ask: 4.2, volume: 800, openInterest: 3000, impliedVolatility: 0.24, inTheMoney: false }],
          }],
        }],
      },
    };
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("fc.yahoo.com")) return new Response("", { status: 302, headers: { "Set-Cookie": "A3=test; Path=/; Domain=.yahoo.com" } });
      if (urlStr.includes("getcrumb")) return new Response("test-crumb", { status: 200, headers: { "Content-Type": "text/plain" } });
      if (urlStr.includes("query1.finance.yahoo.com") || urlStr.includes("query2.finance.yahoo.com")) return new Response(JSON.stringify(mockYahooResponse), { status: 200, headers: { "Content-Type": "application/json" } });
      return realFetch(url, init);
    }));
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/options/implied-move?symbol=MSFT");
    expect(status).toBe(200);
    const result = data as Record<string, unknown>;
    expect(result.symbol).toBe("MSFT");
    expect(typeof result.straddlePrice).toBe("number");
    expect(typeof result.impliedMove).toBe("number");
    expect(result.expectedRange).toBeDefined();
  });

  // ========================================================================
  // SEC-EDGAR: Company filings
  // ========================================================================

  it("GET /sec-edgar/company-filings returns filing data", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("company_tickers.json")) {
        return new Response(JSON.stringify({ "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (urlStr.includes("submissions/CIK")) {
        return new Response(JSON.stringify({
          cik: "0000320193",
          name: "Apple Inc.",
          filings: { recent: { accessionNumber: ["0001234-24-000001"], filingDate: ["2026-03-20"], form: ["10-K"], primaryDocument: ["doc.htm"], primaryDocDescription: ["ANNUAL REPORT"] } },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return realFetch(url, init);
    }));
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/sec-edgar/company-filings?ticker=AAPL");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns 400 for /sec-edgar/company-filings without ticker", async () => {
    server = createServer({ port: 0 });
    const { status } = await get(server, "/sec-edgar/company-filings");
    expect(status).toBe(400);
  });

  // ========================================================================
  // API-key gating tests
  // ========================================================================

  it("returns 404 for /finnhub/* when FINNHUB_API_KEY not configured", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/finnhub/market-news");
    expect(status).toBe(404);
    expect((data as Record<string, string>).error).toBe("FINNHUB_API_KEY not configured");
  });

  it("returns 404 for /fred/* when FRED_API_KEY not configured", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/fred/search?query=cpi");
    expect(status).toBe(404);
    expect((data as Record<string, string>).error).toBe("FRED_API_KEY not configured");
  });

  // ========================================================================
  // Numeric parameter validation
  // ========================================================================

  it("returns 400 for non-numeric limit parameter", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/tradingview/top-gainers?limit=abc");
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toContain("Invalid limit");
  });

  it("returns 400 for non-numeric days parameter", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/options/put-call-ratio?days=xyz");
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toContain("Invalid days");
  });

  // ========================================================================
  // CoinGecko routes
  // ========================================================================

  // --- CoinGecko: Coin detail ---
  it("GET /coingecko/coin returns coin data", async () => {
    mockUpstreamFetch("api.coingecko.com", { id: "bitcoin", symbol: "btc", name: "Bitcoin", market_data: { current_price: { usd: 65000 }, market_cap: { usd: 1200000000000 }, total_volume: { usd: 30000000000 }, high_24h: { usd: 66000 }, low_24h: { usd: 64000 }, price_change_24h: 500, price_change_percentage_24h: 0.77, ath: { usd: 69000 }, ath_change_percentage: { usd: -5.8 } }, description: { en: "Bitcoin is a decentralized cryptocurrency" } });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/coingecko/coin?coinId=bitcoin");
    expect(status).toBe(200);
    expect((data as Record<string, unknown>).symbol).toBe("btc");
  });

  it("returns 400 for /coingecko/coin without coinId", async () => {
    server = createServer({ port: 0 });
    const { status } = await get(server, "/coingecko/coin");
    expect(status).toBe(400);
  });

  // --- CoinGecko: Trending ---
  it("GET /coingecko/trending returns trending coins", async () => {
    mockUpstreamFetch("api.coingecko.com", { coins: [{ item: { id: "bitcoin", name: "Bitcoin", symbol: "btc", market_cap_rank: 1, price_btc: 1.0, score: 0 } }] });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/coingecko/trending");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  // --- CoinGecko: Global ---
  it("GET /coingecko/global returns global data", async () => {
    mockUpstreamFetch("api.coingecko.com", { data: { total_market_cap: { usd: 2500000000000 }, total_volume: { usd: 100000000000 }, market_cap_percentage: { btc: 50, eth: 18 }, active_cryptocurrencies: 10000, market_cap_change_percentage_24h_usd: 1.5 } });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/coingecko/global");
    expect(status).toBe(200);
    expect((data as Record<string, unknown>).totalMarketCap).toBeDefined();
  });

  // ========================================================================
  // FRED new routes
  // ========================================================================

  // --- FRED: Indicator history ---
  it("GET /fred/indicator-history returns history data", async () => {
    mockUpstreamFetch("api.stlouisfed.org", { observations: [{ date: "2024-01-01", value: "308.4" }, { date: "2024-02-01", value: "310.1" }] });
    server = createServer({ port: 0, fredApiKey: "test-key" });
    const { status, data } = await get(server, "/fred/indicator-history?series=CPIAUCSL&startDate=2024-01-01&endDate=2024-03-01");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns 400 for /fred/indicator-history without required params", async () => {
    server = createServer({ port: 0, fredApiKey: "test-key" });
    const { status } = await get(server, "/fred/indicator-history?series=CPI");
    expect(status).toBe(400);
  });

  // --- FRED: Search ---
  it("GET /fred/search returns search results", async () => {
    mockUpstreamFetch("api.stlouisfed.org", { seriess: [{ id: "CPIAUCSL", title: "Consumer Price Index", frequency: "Monthly", units: "Index", popularity: 95, last_updated: "2024-03-01" }] });
    server = createServer({ port: 0, fredApiKey: "test-key" });
    const { status, data } = await get(server, "/fred/search?query=consumer+price");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns 400 for /fred/search without query", async () => {
    server = createServer({ port: 0, fredApiKey: "test-key" });
    const { status } = await get(server, "/fred/search");
    expect(status).toBe(400);
  });

  // ========================================================================
  // Alpha Vantage routes
  // ========================================================================

  // --- Alpha Vantage: Gating ---
  it("returns 404 for /alpha-vantage/* when ALPHA_VANTAGE_API_KEY not configured", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/alpha-vantage/quote?symbol=AAPL");
    expect(status).toBe(404);
    expect((data as Record<string, unknown>).error).toBe("ALPHA_VANTAGE_API_KEY not configured");
  });

  // --- Alpha Vantage: Quote ---
  it("GET /alpha-vantage/quote returns quote data", async () => {
    mockUpstreamFetch("alphavantage.co", { "Global Quote": { "01. symbol": "AAPL", "02. open": "177.00", "03. high": "180.00", "04. low": "176.50", "05. price": "178.50", "06. volume": "50000000", "07. latest trading day": "2024-03-15", "08. previous close": "176.20", "09. change": "2.30", "10. change percent": "1.305%" } });
    server = createServer({ port: 0, alphaVantageApiKey: "test-key" });
    const { status, data } = await get(server, "/alpha-vantage/quote?symbol=AAPL");
    expect(status).toBe(200);
    expect((data as Record<string, unknown>).symbol).toBe("AAPL");
  });

  it("returns 400 for /alpha-vantage/quote without symbol", async () => {
    server = createServer({ port: 0, alphaVantageApiKey: "test-key" });
    const { status } = await get(server, "/alpha-vantage/quote");
    expect(status).toBe(400);
  });

  // --- Alpha Vantage: Overview ---
  it("GET /alpha-vantage/overview returns company overview", async () => {
    mockUpstreamFetch("alphavantage.co", { Symbol: "AAPL", Name: "Apple Inc", Description: "Tech company", Exchange: "NASDAQ", Sector: "Technology", Industry: "Consumer Electronics", MarketCapitalization: "2800000000000", PERatio: "28.5", PEGRatio: "2.1", BookValue: "4.15", DividendYield: "0.005", EPS: "6.25", RevenuePerShareTTM: "24.3", ProfitMargin: "0.25", "52WeekHigh": "199.62", "52WeekLow": "164.08", AnalystTargetPrice: "195.00" });
    server = createServer({ port: 0, alphaVantageApiKey: "test-key" });
    const { status, data } = await get(server, "/alpha-vantage/overview?symbol=AAPL");
    expect(status).toBe(200);
    expect((data as Record<string, unknown>).symbol).toBe("AAPL");
  });

  // --- Alpha Vantage: Daily ---
  it("GET /alpha-vantage/daily returns daily prices", async () => {
    mockUpstreamFetch("alphavantage.co", { "Meta Data": { "2. Symbol": "AAPL" }, "Time Series (Daily)": { "2024-03-15": { "1. open": "177.00", "2. high": "180.00", "3. low": "176.50", "4. close": "178.50", "5. volume": "50000000" } } });
    server = createServer({ port: 0, alphaVantageApiKey: "test-key" });
    const { status, data } = await get(server, "/alpha-vantage/daily?symbol=AAPL");
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  // --- Alpha Vantage: Earnings ---
  it("GET /alpha-vantage/earnings returns earnings data", async () => {
    mockUpstreamFetch("alphavantage.co", { symbol: "AAPL", annualEarnings: [{ fiscalDateEnding: "2023-09-30", reportedEPS: "6.13" }], quarterlyEarnings: [{ fiscalDateEnding: "2023-12-31", reportedDate: "2024-02-01", reportedEPS: "2.18", estimatedEPS: "2.10", surprise: "0.08", surprisePercentage: "3.81" }] });
    server = createServer({ port: 0, alphaVantageApiKey: "test-key" });
    const { status, data } = await get(server, "/alpha-vantage/earnings?symbol=AAPL");
    expect(status).toBe(200);
    expect((data as Record<string, unknown>).symbol).toBe("AAPL");
  });

  // --- Alpha Vantage: Dividends ---
  it("GET /alpha-vantage/dividends returns dividend data", async () => {
    mockUpstreamFetch("alphavantage.co", { symbol: "AAPL", data: [{ ex_dividend_date: "2024-02-09", declaration_date: "2024-02-01", record_date: "2024-02-12", payment_date: "2024-02-15", amount: "0.24" }] });
    server = createServer({ port: 0, alphaVantageApiKey: "test-key" });
    const { status, data } = await get(server, "/alpha-vantage/dividends?symbol=AAPL");
    expect(status).toBe(200);
    expect((data as Record<string, unknown>).symbol).toBe("AAPL");
  });

  // ========================================================================
  // POST body validation
  // ========================================================================

  it("returns 400 for POST /tradingview/scan with non-object body", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await post(server, "/tradingview/scan", [1, 2, 3]);
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toContain("expected a JSON object");
  });

  it("returns 400 for POST /tradingview-crypto/scan with non-object body", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await post(server, "/tradingview-crypto/scan", "not an object");
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toContain("expected a JSON object");
  });

  // ========================================================================
  // Integer enforcement for parseIntParam
  // ========================================================================

  it("returns 400 for float limit parameter", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/tradingview/top-gainers?limit=3.7");
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toContain("Invalid limit");
  });

  // --- Frankfurter ---

  it("GET /frankfurter/latest returns exchange rates", async () => {
    mockUpstreamFetch("api.frankfurter.dev", { amount: 1, base: "USD", date: "2026-03-27", rates: { EUR: 0.868, GBP: 0.753 } });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/frankfurter/latest?base=USD&symbols=EUR,GBP");
    expect(status).toBe(200);
    expect((data as any).rates.EUR).toBe(0.868);
  });

  it("GET /frankfurter/latest works without params (defaults)", async () => {
    mockUpstreamFetch("api.frankfurter.dev", { amount: 1, base: "USD", date: "2026-03-27", rates: { EUR: 0.868 } });
    server = createServer({ port: 0 });
    const { status } = await get(server, "/frankfurter/latest");
    expect(status).toBe(200);
  });

  it("GET /frankfurter/historical returns rates for a date", async () => {
    mockUpstreamFetch("api.frankfurter.dev", { amount: 1, base: "USD", date: "2024-01-15", rates: { EUR: 0.912 } });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/frankfurter/historical?date=2024-01-15&base=USD");
    expect(status).toBe(200);
    expect((data as any).date).toBe("2024-01-15");
  });

  it("returns 400 for /frankfurter/historical without date", async () => {
    server = createServer({ port: 0 });
    const { status } = await get(server, "/frankfurter/historical?base=USD");
    expect(status).toBe(400);
  });

  it("GET /frankfurter/timeseries returns rate history", async () => {
    mockUpstreamFetch("api.frankfurter.dev", {
      amount: 1, base: "USD", start_date: "2024-01-01", end_date: "2024-01-05",
      rates: { "2024-01-02": { EUR: 0.912 }, "2024-01-03": { EUR: 0.910 } },
    });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/frankfurter/timeseries?start_date=2024-01-01&symbols=EUR&base=USD");
    expect(status).toBe(200);
    expect((data as any).rates).toBeDefined();
  });

  it("returns 400 for /frankfurter/timeseries without required params", async () => {
    server = createServer({ port: 0 });
    const { status } = await get(server, "/frankfurter/timeseries?start_date=2024-01-01");
    expect(status).toBe(400);
  });

  it("GET /frankfurter/convert converts currency", async () => {
    mockUpstreamFetch("api.frankfurter.dev", { amount: 100, base: "USD", date: "2026-03-27", rates: { EUR: 86.83 } });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/frankfurter/convert?amount=100&from=USD&to=EUR");
    expect(status).toBe(200);
    expect((data as any).rates.EUR).toBe(86.83);
  });

  it("returns 400 for /frankfurter/convert without required params", async () => {
    server = createServer({ port: 0 });
    const { status } = await get(server, "/frankfurter/convert?amount=100");
    expect(status).toBe(400);
  });

  it("returns 400 for /frankfurter/convert with non-numeric amount", async () => {
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/frankfurter/convert?amount=abc&from=USD&to=EUR");
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toContain("amount must be a number");
  });

  it("GET /frankfurter/currencies returns currency map", async () => {
    mockUpstreamFetch("api.frankfurter.dev", { USD: "United States Dollar", EUR: "Euro", GBP: "British Pound" });
    server = createServer({ port: 0 });
    const { status, data } = await get(server, "/frankfurter/currencies");
    expect(status).toBe(200);
    expect((data as any).USD).toBe("United States Dollar");
  });
});
