import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchFilings, getCompanyFilings, getInstitutionalHoldings, getOwnershipFilings } from "../client.js";

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
          "User-Agent": expect.stringContaining("StockScanner"),
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

  it("uses ticker as search query, not as tickers filter param", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ hits: { hits: [] } }),
    });

    await getCompanyFilings({ ticker: "APLD" });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("q=APLD");
    expect(calledUrl).not.toContain("tickers=");
  });

  it("backfills empty ticker field from input param", async () => {
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
                entity_name: "Applied Digital Corp",
                tickers: "",
                display_names: ["Applied Digital Corp"],
                file_description: "Annual report",
              },
            },
          ],
        },
      }),
    });

    const filings = await getCompanyFilings({ ticker: "apld" });

    expect(filings).toHaveLength(1);
    expect(filings[0].ticker).toBe("APLD");
  });
});

describe("getInstitutionalHoldings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("searches for 13F filings and backfills ticker for short queries", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        hits: {
          hits: [
            {
              _id: "0001234567-24-000010",
              _source: {
                file_num: "001-99999",
                file_date: "2024-06-30",
                form_type: "13F-HR",
                entity_name: "Berkshire Hathaway Inc",
                tickers: "",
                display_names: ["Berkshire Hathaway Inc"],
                file_description: "Quarterly report filed by institutional managers",
              },
            },
          ],
        },
      }),
    });

    const filings = await getInstitutionalHoldings("AAPL", 5);

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("forms=13F-HR");
    expect(filings).toHaveLength(1);
    expect(filings[0].formType).toBe("13F-HR");
    expect(filings[0].ticker).toBe("AAPL");
  });

  it("does not backfill ticker for long manager name queries", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        hits: {
          hits: [
            {
              _id: "0001234567-24-000020",
              _source: {
                file_num: "001-88888",
                file_date: "2024-06-30",
                form_type: "13F-HR",
                entity_name: "Berkshire Hathaway Inc",
                tickers: "BRK-B",
                display_names: ["Berkshire Hathaway Inc"],
                file_description: "13F quarterly report",
              },
            },
          ],
        },
      }),
    });

    const filings = await getInstitutionalHoldings("Berkshire Hathaway", 5);
    expect(filings[0].ticker).toBe("BRK-B");
  });
});

describe("getOwnershipFilings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("searches for 13D/13G filings and backfills ticker", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        hits: {
          hits: [
            {
              _id: "0001234567-24-000030",
              _source: {
                file_num: "005-77777",
                file_date: "2024-08-15",
                form_type: "SC 13D",
                entity_name: "Activist Investor LLC",
                tickers: "",
                display_names: ["Activist Investor LLC"],
                file_description: "Schedule 13D",
              },
            },
          ],
        },
      }),
    });

    const filings = await getOwnershipFilings("TSLA", 5);

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("forms=SC+13D");
    expect(filings).toHaveLength(1);
    expect(filings[0].formType).toBe("SC 13D");
    expect(filings[0].ticker).toBe("TSLA");
  });
});

describe("createSecEdgarModule", () => {
  it("returns module with 6 tools and no required env vars", async () => {
    const { createSecEdgarModule } = await import("../index.js");
    const mod = createSecEdgarModule();
    expect(mod.name).toBe("sec-edgar");
    expect(mod.requiredEnvVars).toEqual([]);
    expect(mod.tools).toHaveLength(6);
    expect(mod.tools.map((t) => t.name)).toEqual([
      "edgar_search",
      "edgar_company_filings",
      "edgar_company_facts",
      "edgar_insider_trades",
      "edgar_institutional_holdings",
      "edgar_ownership_filings",
    ]);
  });
});
