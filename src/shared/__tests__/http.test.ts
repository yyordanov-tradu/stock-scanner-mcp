import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { httpPost, httpGet } from "../http.js";

describe("httpPost", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST with JSON body and returns parsed JSON", async () => {
    const mockResponse = { data: [{ s: "AAPL", d: [1, 2, 3] }] };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await httpPost("https://scanner.tradingview.com/america/scan", {
      symbols: { tickers: ["NASDAQ:AAPL"] },
      columns: ["close"],
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://scanner.tradingview.com/america/scan",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("throws on non-OK response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () => "rate limited",
    });

    await expect(
      httpPost("https://example.com/api", {}),
    ).rejects.toThrow("HTTP 429");
  });

  it("throws on timeout", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((_, reject) =>
        setTimeout(() => reject(new DOMException("aborted", "AbortError")), 100),
      ),
    );

    await expect(
      httpPost("https://example.com/api", {}, { timeoutMs: 50 }),
    ).rejects.toThrow();
  });
});

describe("httpGet", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends GET and returns parsed JSON", async () => {
    const mockResponse = { quote: { c: 150.5 } };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await httpGet("https://finnhub.io/api/v1/quote?symbol=AAPL");
    expect(result).toEqual(mockResponse);
  });

  it("passes custom headers", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await httpGet("https://example.com", { headers: { "X-Token": "abc" } });

    expect(fetch).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        headers: { "X-Token": "abc" },
      }),
    );
  });

  it("strips apikey query parameter from error messages", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "invalid key",
    });

    try {
      await httpGet("https://api.example.com/query?function=QUOTE&symbol=AAPL&apikey=SECRET_KEY_123");
      expect.unreachable("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).not.toContain("SECRET_KEY_123");
      expect(msg).toContain("HTTP 403");
    }
  });

  it("strips apikey from network error messages", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("fetch failed: https://api.example.com/query?apikey=MY_SECRET&symbol=AAPL"),
    );

    try {
      await httpGet("https://api.example.com/query?apikey=MY_SECRET&symbol=AAPL");
      expect.unreachable("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).not.toContain("MY_SECRET");
    }
  });
});
