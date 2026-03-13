import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchFilings, getCompanyFilings } from "../client.js";

describe("searchFilings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends GET with User-Agent and query params", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        hits: {
          hits: [
            {
              _id: "0001234567-24-000001",
              _source: {
                file_num: "001-12345",
                file_date: "2024-03-15",
                form_type: "10-K",
                entity_name: "Apple Inc",
                tickers: "AAPL",
                display_names: ["Apple Inc"],
                file_description: "Annual report",
              },
            },
          ],
        },
      }),
    });

    const filings = await searchFilings({ query: "artificial intelligence" });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("efts.sec.gov"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.stringContaining("stock-scanner-mcp"),
        }),
      }),
    );
    expect(filings).toHaveLength(1);
    expect(filings[0].formType).toBe("10-K");
    expect(filings[0].entityName).toBe("Apple Inc");
    expect(filings[0].accessionNumber).toBe("0001234567-24-000001");
  });

  it("passes form filter in query string", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ hits: { hits: [] } }),
    });

    await searchFilings({ query: "revenue", forms: ["10-K", "10-Q"] });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("forms=10-K%2C10-Q");
  });

  it("respects limit parameter", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ hits: { hits: [] } }),
    });

    await searchFilings({ query: "test", limit: 5 });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("size=5");
  });
});

describe("getCompanyFilings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("searches by ticker", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ hits: { hits: [] } }),
    });

    await getCompanyFilings({ ticker: "AAPL" });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("tickers=AAPL");
  });
});

describe("createSecEdgarModule", () => {
  it("returns module with 2 tools and no required env vars", async () => {
    const { createSecEdgarModule } = await import("../index.js");
    const mod = createSecEdgarModule();
    expect(mod.name).toBe("sec-edgar");
    expect(mod.requiredEnvVars).toEqual([]);
    expect(mod.tools).toHaveLength(2);
    expect(mod.tools.map((t) => t.name)).toEqual([
      "edgar_search",
      "edgar_company_filings",
    ]);
  });
});
