import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scanCrypto } from "../scanner.js";
import { CRYPTO_COLUMNS } from "../columns.js";

describe("CRYPTO_COLUMNS", () => {
  it("has 24 column IDs", () => {
    expect(CRYPTO_COLUMNS).toHaveLength(23);
  });

  it("includes key crypto indicators", () => {
    expect(CRYPTO_COLUMNS).toContain("close");
    expect(CRYPTO_COLUMNS).toContain("market_cap_calc");
    expect(CRYPTO_COLUMNS).toContain("RSI");
  });
});

describe("scanCrypto", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST to crypto scanner API and maps response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { s: "BINANCE:BTCUSDT", d: [42000, 2.5, 1050, 1500000000, 800e9, 0.5, 0.6, 0.4, 55, 100, 80, 60, 58, 41000, 43000, 41500, 41800, 40000, 41500, 41800, 40000, 2000000000, "Bitcoin / TetherUS", "BTCUSDT"] },
        ],
      }),
    });

    const rows = await scanCrypto({ tickers: ["BINANCE:BTCUSDT"] });

    expect(fetch).toHaveBeenCalledWith(
      "https://scanner.tradingview.com/crypto/scan",
      expect.objectContaining({ method: "POST" }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].symbol).toBe("BINANCE:BTCUSDT");
  });

  it("applies timeframe suffix for 1h", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await scanCrypto({ timeframe: "1h", columns: ["close", "RSI", "name"] });

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.columns).toContain("close|60");
    expect(callBody.columns).toContain("RSI|60");
    expect(callBody.columns).toContain("name"); // no suffix for metadata
  });

  it("applies filters when no tickers", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await scanCrypto({ filters: [{ left: "change", operation: "greater", right: 5 }] });

    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(callBody.filter2.operands[0].left).toBe("change");
  });
});

describe("createTradingviewCryptoModule", () => {
  it("returns module with 4 tools and no required env vars", async () => {
    const { createTradingviewCryptoModule } = await import("../index.js");
    const mod = createTradingviewCryptoModule();
    expect(mod.name).toBe("tradingview-crypto");
    expect(mod.requiredEnvVars).toEqual([]);
    expect(mod.tools).toHaveLength(4);
    expect(mod.tools.map((t) => t.name)).toEqual([
      "crypto_scan", "crypto_quote", "crypto_technicals", "crypto_top_gainers",
    ]);
  });
});
