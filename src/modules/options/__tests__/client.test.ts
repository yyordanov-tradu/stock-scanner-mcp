import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("getExpirations", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches expirations with correct URL and auth header", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        expirations: {
          date: ["2026-03-20", "2026-03-27", "2026-04-03"],
        },
      }),
    });

    const { getExpirations } = await import("../client.js");
    const result = await getExpirations("test-token", "AAPL");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/expirations?symbol=AAPL"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
    expect(result).toEqual(["2026-03-20", "2026-03-27", "2026-04-03"]);
  });

  it("returns empty array when no expirations found", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ expirations: null }),
    });

    const { getExpirations } = await import("../client.js");
    const result = await getExpirations("test-token", "INVALID");

    expect(result).toEqual([]);
  });

  it("propagates HTTP errors from httpGet", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "Invalid token",
    });

    const { getExpirations } = await import("../client.js");
    await expect(getExpirations("bad-token", "AAPL")).rejects.toThrow("HTTP 401");
  });
});

describe("getOptionsChain", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches chain with greeks=true and maps response fields correctly", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        options: {
          option: [
            {
              symbol: "AAPL260320C00150000",
              strike: 150,
              option_type: "call",
              expiration_date: "2026-03-20",
              last: 12.5,
              bid: 12.0,
              ask: 13.0,
              volume: 1500,
              open_interest: 25000,
              greeks: {
                delta: 0.65,
                gamma: 0.03,
                theta: -0.05,
                vega: 0.25,
                mid_iv: 0.32,
              },
            },
          ],
        },
      }),
    });

    const { getOptionsChain } = await import("../client.js");
    const result = await getOptionsChain("test-token", "AAPL", "2026-03-20");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("greeks=true");
    expect(calledUrl).toContain("symbol=AAPL");
    expect(calledUrl).toContain("expiration=2026-03-20");

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );

    expect(result).toHaveLength(1);
    expect(result[0].optionType).toBe("call");
    expect(result[0].openInterest).toBe(25000);
    expect(result[0].delta).toBe(0.65);
    expect(result[0].iv).toBe(0.32);
    expect(result[0].strike).toBe(150);
  });

  it("returns empty array when no options found", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ options: null }),
    });

    const { getOptionsChain } = await import("../client.js");
    const result = await getOptionsChain("test-token", "INVALID", "2026-03-20");

    expect(result).toEqual([]);
  });

  it("handles single option (non-array response)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        options: {
          option: {
            symbol: "MSFT260327P00400000",
            strike: 400,
            option_type: "put",
            expiration_date: "2026-03-27",
            last: 3.2,
            bid: 3.0,
            ask: 3.4,
            volume: 800,
            open_interest: 12000,
            greeks: {
              delta: -0.35,
              gamma: 0.03,
              theta: -0.04,
              vega: 0.22,
              mid_iv: 0.30,
            },
          },
        },
      }),
    });

    const { getOptionsChain } = await import("../client.js");
    const result = await getOptionsChain("test-token", "MSFT", "2026-03-27");

    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe("MSFT260327P00400000");
    expect(result[0].optionType).toBe("put");
    expect(result[0].delta).toBe(-0.35);
  });

  it("propagates HTTP errors from httpGet", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () => "Rate limit exceeded",
    });

    const { getOptionsChain } = await import("../client.js");
    await expect(
      getOptionsChain("test-token", "AAPL", "2026-03-20"),
    ).rejects.toThrow("HTTP 429");
  });
});
