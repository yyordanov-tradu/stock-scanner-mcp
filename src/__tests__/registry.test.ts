import { describe, it, expect } from "vitest";
import { resolveEnabledModules } from "../registry.js";
import type { ModuleDefinition } from "../shared/types.js";

const mockModules: ModuleDefinition[] = [
  { name: "free-mod", description: "Free", requiredEnvVars: [], tools: [] },
  { name: "paid-mod", description: "Paid", requiredEnvVars: ["PAID_KEY"], tools: [] },
  { name: "multi-key", description: "Multi", requiredEnvVars: ["KEY_A", "KEY_B"], tools: [] },
];

describe("resolveEnabledModules", () => {
  it("enables modules with no required env vars", () => {
    const result = resolveEnabledModules(mockModules, {});
    expect(result.map((m) => m.name)).toEqual(["free-mod"]);
  });

  it("enables modules when env vars are present", () => {
    const result = resolveEnabledModules(mockModules, { PAID_KEY: "abc" });
    expect(result.map((m) => m.name)).toEqual(["free-mod", "paid-mod"]);
  });

  it("requires ALL env vars for multi-key modules", () => {
    const result = resolveEnabledModules(mockModules, { KEY_A: "a" });
    expect(result.map((m) => m.name)).toEqual(["free-mod"]);
  });

  it("enables multi-key module when all keys present", () => {
    const result = resolveEnabledModules(mockModules, { KEY_A: "a", KEY_B: "b" });
    expect(result.map((m) => m.name)).toEqual(["free-mod", "multi-key"]);
  });

  it("respects explicit module filter", () => {
    const result = resolveEnabledModules(mockModules, { PAID_KEY: "abc" }, ["paid-mod"]);
    expect(result.map((m) => m.name)).toEqual(["paid-mod"]);
  });

  it("skips filtered module if env var missing", () => {
    const result = resolveEnabledModules(mockModules, {}, ["paid-mod"]);
    expect(result).toEqual([]);
  });
});
