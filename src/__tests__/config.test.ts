import { describe, it, expect, vi, afterEach } from "vitest";
import { parseConfig } from "../config.js";

describe("parseConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns defaults with no args", () => {
    const config = parseConfig([]);
    expect(config.defaultExchange).toBe("NASDAQ");
    expect(config.enabledModules).toBeUndefined();
  });

  it("parses --modules flag", () => {
    const config = parseConfig(["--modules", "tradingview,finnhub"]);
    expect(config.enabledModules).toEqual(["tradingview", "finnhub"]);
  });

  it("parses --default-exchange flag", () => {
    const config = parseConfig(["--default-exchange", "NYSE"]);
    expect(config.defaultExchange).toBe("NYSE");
  });

  it("reads API keys from env", () => {
    vi.stubEnv("FINNHUB_API_KEY", "test-key");
    const config = parseConfig([]);
    expect(config.env.FINNHUB_API_KEY).toBe("test-key");
  });

  it("returns undefined for missing env vars", () => {
    vi.stubEnv("FINNHUB_API_KEY", undefined as unknown as string);
    const config = parseConfig([]);
    expect(config.env.FINNHUB_API_KEY).toBeUndefined();
  });
});
