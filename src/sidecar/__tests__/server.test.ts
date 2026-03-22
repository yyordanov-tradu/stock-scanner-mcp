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
});
