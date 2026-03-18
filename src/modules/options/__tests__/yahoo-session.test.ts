import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

function mockFetchSequence(...responses: Array<{ ok: boolean; status?: number; headers?: any; text?: () => Promise<string> }>) {
  const fn = vi.fn();
  for (const resp of responses) {
    fn.mockResolvedValueOnce(resp);
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

function cookieResponse() {
  return {
    ok: false,
    status: 404,
    headers: {
      getSetCookie: () => ["A3=test-cookie-value; Domain=.yahoo.com; Path=/; Secure; HttpOnly"],
      get: (name: string) => name === "set-cookie" ? "A3=test-cookie-value; Domain=.yahoo.com" : null,
    },
  };
}

function crumbResponse(crumb = "test-crumb-abc") {
  return {
    ok: true,
    status: 200,
    text: async () => crumb,
  };
}

describe("yahoo-session", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getSession fetches cookie then crumb and caches the session", async () => {
    const fetchMock = mockFetchSequence(cookieResponse(), crumbResponse());

    const { getSession } = await import("../yahoo-session.js");
    const sess = await getSession();

    expect(sess.cookie).toBe("A3=test-cookie-value");
    expect(sess.crumb).toBe("test-crumb-abc");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Second call should return cached — no more fetch calls
    const sess2 = await getSession();
    expect(sess2).toBe(sess);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("invalidateSession forces a fresh session on next call", async () => {
    const fetchMock = mockFetchSequence(
      cookieResponse(), crumbResponse("crumb-1"),
      cookieResponse(), crumbResponse("crumb-2"),
    );

    const { getSession, invalidateSession } = await import("../yahoo-session.js");
    const sess1 = await getSession();
    expect(sess1.crumb).toBe("crumb-1");

    invalidateSession();
    const sess2 = await getSession();
    expect(sess2.crumb).toBe("crumb-2");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("throws when A3 cookie is not returned", async () => {
    mockFetchSequence({
      ok: false,
      status: 404,
      headers: {
        getSetCookie: () => ["OTHER=value"],
        get: () => "OTHER=value",
      },
    });

    const { getSession } = await import("../yahoo-session.js");
    await expect(getSession()).rejects.toThrow("failed to obtain A3 cookie");
  });

  it("throws when crumb endpoint returns non-200", async () => {
    mockFetchSequence(cookieResponse(), {
      ok: false,
      status: 429,
      text: async () => "Too Many Requests",
    });

    const { getSession } = await import("../yahoo-session.js");
    await expect(getSession()).rejects.toThrow("IP rate limited (429)");
  });

  it("throws when crumb response contains error text", async () => {
    mockFetchSequence(cookieResponse(), crumbResponse("Too Many Requests"));

    const { getSession } = await import("../yahoo-session.js");
    await expect(getSession()).rejects.toThrow("invalid crumb response");
  });

  it("appendCrumb adds crumb parameter to URL without query string", async () => {
    mockFetchSequence(cookieResponse(), crumbResponse("my-crumb"));

    const { appendCrumb } = await import("../yahoo-session.js");
    const url = await appendCrumb("https://example.com/api");
    expect(url).toBe("https://example.com/api?crumb=my-crumb");
  });

  it("appendCrumb adds crumb parameter to URL with existing query string", async () => {
    mockFetchSequence(cookieResponse(), crumbResponse("my-crumb"));

    const { appendCrumb } = await import("../yahoo-session.js");
    const url = await appendCrumb("https://example.com/api?date=123");
    expect(url).toBe("https://example.com/api?date=123&crumb=my-crumb");
  });

  it("getYahooHeaders includes Cookie, User-Agent, Referer, and Accept", async () => {
    mockFetchSequence(cookieResponse(), crumbResponse());

    const { getYahooHeaders } = await import("../yahoo-session.js");
    const headers = await getYahooHeaders();

    expect(headers["Cookie"]).toBe("A3=test-cookie-value");
    expect(headers["User-Agent"]).toContain("Mozilla");
    expect(headers["Referer"]).toBe("https://finance.yahoo.com");
    expect(headers["Accept"]).toBe("*/*");
  });

  it("deduplicates concurrent getSession calls", async () => {
    const fetchMock = mockFetchSequence(cookieResponse(), crumbResponse("dedup-crumb"));

    const { getSession } = await import("../yahoo-session.js");

    // Fire 5 concurrent calls — should only trigger 1 session creation
    const results = await Promise.all([
      getSession(), getSession(), getSession(), getSession(), getSession(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 cookie + 1 crumb
    for (const sess of results) {
      expect(sess.crumb).toBe("dedup-crumb");
    }
  });

  it("refreshes session after TTL expires", async () => {
    const fetchMock = mockFetchSequence(
      cookieResponse(), crumbResponse("crumb-fresh"),
      cookieResponse(), crumbResponse("crumb-refreshed"),
    );

    const { getSession } = await import("../yahoo-session.js");

    const sess1 = await getSession();
    expect(sess1.crumb).toBe("crumb-fresh");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Simulate TTL expiry by backdating createdAt
    (sess1 as any).createdAt = Date.now() - 31 * 60 * 1000; // 31 minutes ago

    const sess2 = await getSession();
    expect(sess2.crumb).toBe("crumb-refreshed");
    expect(fetchMock).toHaveBeenCalledTimes(4); // 2 more fetch calls for new session
  });
});
