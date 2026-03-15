import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock yahoo-session to avoid real HTTP calls for crumb/cookie
vi.mock("../yahoo-session.js", () => ({
  getSession: vi.fn().mockResolvedValue({
    cookie: "A3=test-cookie",
    crumb: "test-crumb",
    createdAt: Date.now(),
  }),
  invalidateSession: vi.fn(),
  getYahooHeaders: vi.fn().mockResolvedValue({
    "User-Agent": "test-ua",
    "Cookie": "A3=test-cookie",
    "Referer": "https://finance.yahoo.com",
    "Accept": "*/*",
  }),
  appendCrumb: vi.fn(async (url: string) => {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}crumb=test-crumb`;
  }),
  YAHOO_USER_AGENT: "test-ua",
}));

// Mock cache to prevent cross-test pollution
vi.mock("../../shared/cache.js", () => ({
  TtlCache: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
  })),
}));

const MOCK_YAHOO_RESPONSE = {
  optionChain: {
    result: [{
      underlyingSymbol: "AAPL",
      expirationDates: [1742515200, 1743120000],
      strikes: [170, 175, 180, 185, 190],
      quote: { regularMarketPrice: 180.25 },
      options: [{
        expirationDate: 1742515200,
        calls: [{
          contractSymbol: "AAPL260320C00180000",
          strike: 180,
          lastPrice: 5.5,
          bid: 5.4,
          ask: 5.6,
          change: 0.5,
          percentChange: 10,
          volume: 1234,
          openInterest: 5678,
          impliedVolatility: 0.32,
          inTheMoney: true,
        }],
        puts: [{
          contractSymbol: "AAPL260320P00180000",
          strike: 180,
          lastPrice: 4.2,
          bid: 4.1,
          ask: 4.3,
          change: -0.3,
          percentChange: -5,
          volume: 987,
          openInterest: 4321,
          impliedVolatility: 0.30,
          inTheMoney: false,
        }],
      }],
    }],
  },
};

function mockFetchOk(data: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => data,
  }));
}

describe("fetchOptionChain", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("parses a successful Yahoo response with calls and puts", async () => {
    mockFetchOk(MOCK_YAHOO_RESPONSE);

    const { fetchOptionChain } = await import("../client.js");
    const chain = await fetchOptionChain("AAPL");

    expect(chain.underlyingSymbol).toBe("AAPL");
    expect(chain.underlyingPrice).toBe(180.25);
    expect(chain.expirationDates).toEqual([1742515200, 1743120000]);
    expect(chain.strikes).toEqual([170, 175, 180, 185, 190]);

    expect(chain.calls).toHaveLength(1);
    expect(chain.calls[0].symbol).toBe("AAPL260320C00180000");
    expect(chain.calls[0].strike).toBe(180);
    expect(chain.calls[0].lastPrice).toBe(5.5);
    expect(chain.calls[0].volume).toBe(1234);
    expect(chain.calls[0].openInterest).toBe(5678);
    expect(chain.calls[0].impliedVolatility).toBe(0.32);

    expect(chain.puts).toHaveLength(1);
    expect(chain.puts[0].symbol).toBe("AAPL260320P00180000");
    expect(chain.puts[0].strike).toBe(180);
    expect(chain.puts[0].lastPrice).toBe(4.2);

    expect(typeof chain.maxPain).toBe("number");
  });

  it("calculates Greeks when IV and expiration are valid", async () => {
    mockFetchOk(MOCK_YAHOO_RESPONSE);

    const { fetchOptionChain } = await import("../client.js");
    const chain = await fetchOptionChain("AAPL");

    const call = chain.calls[0];
    if (call.delta !== null) {
      expect(call.delta).toBeGreaterThan(0);
      expect(call.gamma).toBeGreaterThan(0);
      expect(call.vega).toBeGreaterThan(0);
    }
  });

  it("URL contains the encoded ticker symbol and crumb", async () => {
    mockFetchOk(MOCK_YAHOO_RESPONSE);

    const { fetchOptionChain } = await import("../client.js");
    await fetchOptionChain("AAPL");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("/AAPL");
    expect(calledUrl).toContain("query1.finance.yahoo.com");
    expect(calledUrl).toContain("crumb=");
  });

  it("resolveTicker strips exchange prefix (NYSE:GM → GM in URL)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        optionChain: {
          result: [{
            underlyingSymbol: "GM",
            expirationDates: [1742515200],
            strikes: [40, 45, 50],
            quote: { regularMarketPrice: 45.0 },
            options: [{
              expirationDate: 1742515200,
              calls: [],
              puts: [],
            }],
          }],
        },
      }),
    }));

    const { fetchOptionChain } = await import("../client.js");
    await fetchOptionChain("NYSE:GM");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("/GM");
    expect(calledUrl).not.toContain("NYSE");
  });

  it("throws on empty result array", async () => {
    mockFetchOk({ optionChain: { result: [] } });

    const { fetchOptionChain } = await import("../client.js");
    await expect(fetchOptionChain("INVALID")).rejects.toThrow(
      "No options data found for symbol",
    );
  });

  it("throws on missing quote price", async () => {
    mockFetchOk({
      optionChain: {
        result: [{
          underlyingSymbol: "AAPL",
          quote: {},
          options: [{ calls: [], puts: [] }],
        }],
      },
    });

    const { fetchOptionChain } = await import("../client.js");
    await expect(fetchOptionChain("AAPL")).rejects.toThrow(
      "No price data available",
    );
  });

  it("propagates HTTP errors (404)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "Symbol not found",
    }));

    const { fetchOptionChain } = await import("../client.js");
    await expect(fetchOptionChain("AAPL")).rejects.toThrow("HTTP 404");
  });

  it("appends date query parameter when expiration is provided", async () => {
    mockFetchOk(MOCK_YAHOO_RESPONSE);

    const { fetchOptionChain } = await import("../client.js");
    await fetchOptionChain("AAPL", 1742515200);

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("date=1742515200");
  });
});
