import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../client.js", () => ({
  getExpirations: vi.fn(),
  getOptionsChain: vi.fn(),
}));

vi.mock("../max-pain.js", () => ({
  calculateMaxPain: vi.fn(),
}));

import { createOptionsModule } from "../index.js";
import { getExpirations, getOptionsChain } from "../client.js";
import { calculateMaxPain } from "../max-pain.js";
import type { OptionContract } from "../client.js";

function makeContract(overrides: Partial<OptionContract> = {}): OptionContract {
  return {
    symbol: "AAPL260320C00150000",
    strike: 150,
    optionType: "call",
    expiration: "2026-03-20",
    last: 5.0,
    bid: 4.8,
    ask: 5.2,
    volume: 500,
    openInterest: 1000,
    delta: 0.5,
    gamma: 0.03,
    theta: -0.05,
    vega: 0.2,
    iv: 0.3,
    ...overrides,
  };
}

describe("createOptionsModule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns module with 4 tools and requires TRADIER_API_TOKEN", () => {
    const mod = createOptionsModule("test-token");
    expect(mod.name).toBe("options");
    expect(mod.requiredEnvVars).toEqual(["TRADIER_API_TOKEN"]);
    expect(mod.tools).toHaveLength(4);
    expect(mod.tools.map(t => t.name)).toEqual([
      "options_chain",
      "options_expirations",
      "options_unusual_activity",
      "options_max_pain",
    ]);
  });

  describe("options_chain handler", () => {
    it("filters by side=call", async () => {
      const mod = createOptionsModule("tok");
      const handler = mod.tools[0].handler;
      const chain = [
        makeContract({ optionType: "call", strike: 150 }),
        makeContract({ optionType: "put", strike: 150 }),
        makeContract({ optionType: "call", strike: 160 }),
      ];
      (getOptionsChain as ReturnType<typeof vi.fn>).mockResolvedValue(chain);

      const result = await handler({ symbol: "aapl", expiration: "2026-03-20", side: "call" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(2);
      expect(parsed.every((c: OptionContract) => c.optionType === "call")).toBe(true);
    });

    it("filters by min_open_interest", async () => {
      const mod = createOptionsModule("tok");
      const handler = mod.tools[0].handler;
      const chain = [
        makeContract({ openInterest: 5000 }),
        makeContract({ openInterest: 100 }),
        makeContract({ openInterest: 10000 }),
      ];
      (getOptionsChain as ReturnType<typeof vi.fn>).mockResolvedValue(chain);

      const result = await handler({ symbol: "AAPL", expiration: "2026-03-20", min_open_interest: 1000 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(2);
    });

    it("caps limit at 200", async () => {
      const mod = createOptionsModule("tok");
      const handler = mod.tools[0].handler;
      const chain = Array.from({ length: 300 }, (_, i) =>
        makeContract({ strike: 100 + i }),
      );
      (getOptionsChain as ReturnType<typeof vi.fn>).mockResolvedValue(chain);

      const result = await handler({ symbol: "AAPL", expiration: "2026-03-20", limit: 500 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(200);
    });

    it("respects limit parameter below cap", async () => {
      const mod = createOptionsModule("tok");
      const handler = mod.tools[0].handler;
      const chain = Array.from({ length: 10 }, (_, i) =>
        makeContract({ strike: 150 + i }),
      );
      (getOptionsChain as ReturnType<typeof vi.fn>).mockResolvedValue(chain);

      const result = await handler({ symbol: "AAPL", expiration: "2026-03-20", limit: 3 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(3);
    });

    it("uses resolveTicker to strip exchange prefix", async () => {
      const mod = createOptionsModule("tok");
      const handler = mod.tools[0].handler;
      (getOptionsChain as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await handler({ symbol: "NYSE:GM", expiration: "2026-03-20" });
      expect(getOptionsChain).toHaveBeenCalledWith("tok", "GM", "2026-03-20");
    });

    it("uppercases the symbol via resolveTicker", async () => {
      const mod = createOptionsModule("tok");
      const handler = mod.tools[0].handler;
      (getOptionsChain as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await handler({ symbol: "aapl", expiration: "2026-03-20" });
      expect(getOptionsChain).toHaveBeenCalledWith("tok", "AAPL", "2026-03-20");
    });
  });

  describe("options_unusual_activity handler", () => {
    it("flags contracts where volume/OI exceeds ratio threshold", async () => {
      const mod = createOptionsModule("tok");
      const handler = mod.tools[2].handler;
      (getExpirations as ReturnType<typeof vi.fn>).mockResolvedValue(["2026-03-20", "2026-03-27"]);
      (getOptionsChain as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeContract({ volume: 5000, openInterest: 1000 }), // ratio 5.0 — unusual
        makeContract({ volume: 200, openInterest: 1000 }),   // ratio 0.2 — normal
        makeContract({ volume: 400, openInterest: 100 }),    // ratio 4.0 — unusual
        makeContract({ volume: 50, openInterest: 10 }),      // ratio 5.0 but vol < 100 — filtered
      ]);

      const result = await handler({ symbol: "AAPL" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.unusual.length).toBeGreaterThanOrEqual(2);
      expect(parsed.unusual.every((c: { volumeOiRatio: number }) => c.volumeOiRatio >= 3.0)).toBe(true);
    });

    it("enforces minimum OI floor of 10", async () => {
      const mod = createOptionsModule("tok");
      const handler = mod.tools[2].handler;
      (getExpirations as ReturnType<typeof vi.fn>).mockResolvedValue(["2026-03-20"]);
      (getOptionsChain as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeContract({ volume: 500, openInterest: 5 }),   // OI < 10 — filtered
        makeContract({ volume: 500, openInterest: 10 }),  // OI = 10 — passes
        makeContract({ volume: 500, openInterest: 100 }), // OI = 100 — passes
      ]);

      const result = await handler({ symbol: "AAPL", volume_oi_ratio: 1.0, min_volume: 100 });
      const parsed = JSON.parse(result.content[0].text);
      // Only OI >= 10 contracts pass
      expect(parsed.unusual).toHaveLength(2);
    });

    it("fetches expirations in parallel via Promise.all", async () => {
      const mod = createOptionsModule("tok");
      const handler = mod.tools[2].handler;
      (getExpirations as ReturnType<typeof vi.fn>).mockResolvedValue(["2026-03-20", "2026-03-27"]);
      (getOptionsChain as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeContract({ volume: 5000, openInterest: 1000 }),
      ]);

      await handler({ symbol: "AAPL" });
      // Both expirations fetched
      expect(getOptionsChain).toHaveBeenCalledTimes(2);
    });

    it("filters unusual activity by side", async () => {
      const mod = createOptionsModule("tok");
      const handler = mod.tools[2].handler;
      (getExpirations as ReturnType<typeof vi.fn>).mockResolvedValue(["2026-03-20"]);
      (getOptionsChain as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeContract({ volume: 5000, openInterest: 1000, optionType: "call" }),
        makeContract({ volume: 5000, openInterest: 1000, optionType: "put" }),
      ]);

      const result = await handler({ symbol: "AAPL", side: "put" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.unusual).toHaveLength(1);
      expect(parsed.unusual[0].optionType).toBe("put");
    });

    it("returns empty array when no expirations available", async () => {
      const mod = createOptionsModule("tok");
      const handler = mod.tools[2].handler;
      (getExpirations as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await handler({ symbol: "AAPL" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.unusual).toEqual([]);
      expect(parsed.message).toBe("No options available");
    });

    it("sorts by volume descending and caps at 20", async () => {
      const mod = createOptionsModule("tok");
      const handler = mod.tools[2].handler;
      (getExpirations as ReturnType<typeof vi.fn>).mockResolvedValue(["2026-03-20"]);
      const contracts = Array.from({ length: 25 }, (_, i) =>
        makeContract({ volume: 1000 + i * 100, openInterest: 100 }),
      );
      (getOptionsChain as ReturnType<typeof vi.fn>).mockResolvedValue(contracts);

      const result = await handler({ symbol: "AAPL", volume_oi_ratio: 1.0, min_volume: 100 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.unusual).toHaveLength(20);
      expect(parsed.unusual[0].volume).toBeGreaterThan(parsed.unusual[19].volume);
    });
  });

  describe("options_max_pain handler", () => {
    it("passes chain to calculateMaxPain and returns result", async () => {
      const mod = createOptionsModule("tok");
      const handler = mod.tools[3].handler;
      const chain = [makeContract()];
      (getOptionsChain as ReturnType<typeof vi.fn>).mockResolvedValue(chain);
      (calculateMaxPain as ReturnType<typeof vi.fn>).mockReturnValue({
        maxPainStrike: 150,
        painCurve: [{ strike: 150, totalPain: 0 }],
      });

      const result = await handler({ symbol: "aapl", expiration: "2026-03-20" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.maxPainStrike).toBe(150);
      expect(parsed.symbol).toBe("AAPL");
      expect(calculateMaxPain).toHaveBeenCalledWith(chain);
    });

    it("resolves ticker with exchange prefix", async () => {
      const mod = createOptionsModule("tok");
      const handler = mod.tools[3].handler;
      (getOptionsChain as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (calculateMaxPain as ReturnType<typeof vi.fn>).mockReturnValue({
        maxPainStrike: 0,
        painCurve: [],
      });

      const result = await handler({ symbol: "NYSE:GM", expiration: "2026-03-20" });
      expect(getOptionsChain).toHaveBeenCalledWith("tok", "GM", "2026-03-20");
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.symbol).toBe("GM");
    });
  });
});
