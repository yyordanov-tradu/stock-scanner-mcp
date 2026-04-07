import { describe, it, expect, vi, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
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

  it("rejects --data-dir outside home when workspace enabled", () => {
    expect(() =>
      parseConfig(["--enable-workspace", "--data-dir", "/tmp/evil"]),
    ).toThrow("must be under");
  });

  it("accepts --data-dir under home when workspace enabled", () => {
    const validDir = path.join(os.homedir(), "test-scanner-data");
    const config = parseConfig(["--enable-workspace", "--data-dir", validDir]);
    expect(config.dataDir).toBe(validDir);
  });

  it("accepts home directory itself as data-dir", () => {
    expect(() =>
      parseConfig(["--enable-workspace", "--data-dir", os.homedir()]),
    ).not.toThrow();
  });

  it("does NOT validate data-dir when workspace is disabled", () => {
    const config = parseConfig(["--data-dir", "/tmp/evil"]);
    expect(config.enableWorkspace).toBe(false);
  });

  it("stores resolved absolute path in dataDir", () => {
    const relPath = path.join(os.homedir(), "relative", "..", "test-data");
    const config = parseConfig(["--enable-workspace", "--data-dir", relPath]);
    expect(path.isAbsolute(config.dataDir!)).toBe(true);
    expect(config.dataDir).not.toContain("..");
  });
});
