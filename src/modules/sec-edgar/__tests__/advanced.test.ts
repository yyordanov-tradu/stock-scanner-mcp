import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCikForTicker, __resetForTests } from "../cik-mapper.js";
import { getCompanyFacts } from "../client.js";

describe("cik-mapper", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    __resetForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and maps ticker to padded CIK", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
        "1": { cik_str: 789011, ticker: "MSFT", title: "Microsoft Corp" },
      }),
    });

    const cik = await getCikForTicker("AAPL");
    expect(cik).toBe("0000320193");
    expect(fetch).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const cik2 = await getCikForTicker("MSFT");
    expect(cik2).toBe("0000789011");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("getCompanyFacts", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    __resetForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retrieves and summarizes company facts", async () => {
    // First mock for CIK mapping
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
      }),
    });

    // Second mock for facts
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        cik: 320193,
        entityName: "Apple Inc.",
        facts: {
          "us-gaap": {
            "NetIncomeLoss": {
              units: {
                "USD": [
                  { val: 1000, end: "2023-01-01", accn: "1", fy: 2023, fp: "Q1", form: "10-Q", filed: "2023-01-02" },
                  { val: 2000, end: "2024-01-01", accn: "2", fy: 2024, fp: "Q1", form: "10-Q", filed: "2024-01-02" },
                ],
              },
            },
          },
        },
      }),
    });

    const facts = await getCompanyFacts("AAPL");
    expect(facts.entityName).toBe("Apple Inc.");
    expect(facts.metrics.NetIncome.val).toBe(2000);
    expect(facts.metrics.NetIncome.end).toBe("2024-01-01");
  });
});
