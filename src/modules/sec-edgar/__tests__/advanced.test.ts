import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCikForTicker, __resetForTests } from "../cik-mapper.js";
import { getCompanyFacts, getInsiderTrades } from "../client.js";
import { createSecEdgarModule } from "../index.js";

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
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." } }),
    });

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

describe("getInsiderTrades", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    __resetForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retrieves and parses Form 4 filings", async () => {
    // 1. Mock CIK
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ "0": { cik_str: 1144879, ticker: "APLD", title: "Applied Digital" } }),
    });

    // 2. Mock Submissions
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        cik: "1144879",
        name: "Applied Digital Corp.",
        filings: {
          recent: {
            accessionNumber: ["001", "002"],
            filingDate: [new Date().toISOString().split("T")[0], "2023-01-01"],
            form: ["4", "8-K"],
            primaryDocument: ["doc1.xml", "doc2.htm"],
            primaryDocDescription: ["FORM 4", "CURRENT REPORT"],
          },
        },
      }),
    });

    // 3. Mock XML for Form 4
    const mockXml = `
      <ownershipDocument>
        <rptOwnerName>Laltrello Laura</rptOwnerName>
        <rptOwnerOfficerTitle>Director</rptOwnerOfficerTitle>
        <nonDerivativeTransaction>
          <securityTitle><value>Common Stock</value></securityTitle>
          <transactionDate><value>2026-01-06</value></transactionDate>
          <transactionCoding><transactionCode>S</transactionCode></transactionCoding>
          <transactionShares><value>82764</value></transactionShares>
          <transactionPricePerShare><value>30.27</value></transactionPricePerShare>
        </nonDerivativeTransaction>
      </ownershipDocument>
    `;
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: async () => mockXml,
    });

    const trades = await getInsiderTrades("APLD", 5);
    expect(trades).toHaveLength(1);
    expect(trades[0].formType).toBe("4");
    expect(trades[0].parsedTransactions).toHaveLength(1);
    const t = trades[0].parsedTransactions![0];
    expect(t.reporter).toBe("Laltrello Laura");
    expect(t.type).toBe("SELL");
    expect(t.shares).toBe(82764);
    expect(t.price).toBe(30.27);
  });
});

describe("createSecEdgarModule", () => {
  it("returns module with 6 tools", () => {
    const mod = createSecEdgarModule();
    expect(mod.tools).toHaveLength(6);
  });
});
