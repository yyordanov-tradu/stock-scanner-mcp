import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseNodeVersion,
  isSqliteNodeSupported,
  sqliteNodeRequirementMessage,
  suppressSqliteExperimentalWarning,
} from "../node-version.js";

describe("node-version", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses major/minor with or without a leading v", () => {
    expect(parseNodeVersion("v22.13.1")).toEqual({ major: 22, minor: 13 });
    expect(parseNodeVersion("24.0.0")).toEqual({ major: 24, minor: 0 });
  });

  it("requires Node >= 22.13 for node:sqlite features", () => {
    expect(isSqliteNodeSupported("20.20.2")).toBe(false);
    expect(isSqliteNodeSupported("22.12.9")).toBe(false);
    expect(isSqliteNodeSupported("22.13.0")).toBe(true);
    expect(isSqliteNodeSupported("23.4.0")).toBe(true);
    expect(isSqliteNodeSupported("24.0.0")).toBe(true);
  });

  it("returns a readable requirement message only for unsupported versions", () => {
    expect(sqliteNodeRequirementMessage("the workspace module", "--enable-workspace", "22.13.0")).toBeNull();
    const msg = sqliteNodeRequirementMessage("the workspace module", "--enable-workspace", "20.20.2");
    expect(msg).toContain("the workspace module (--enable-workspace) requires Node.js >= 22.13");
    expect(msg).toContain("v20.20.2");
    expect(msg).toContain("start without --enable-workspace");
  });

  it("suppresses only the node:sqlite ExperimentalWarning, delegating everything else", () => {
    const original = vi.fn();
    const proc = { emitWarning: original } as unknown as NodeJS.Process;

    suppressSqliteExperimentalWarning(proc);

    proc.emitWarning("SQLite is an experimental feature and might change at any time", "ExperimentalWarning");
    proc.emitWarning("SQLite is an experimental feature", { type: "ExperimentalWarning" });
    proc.emitWarning(Object.assign(new Error("SQLite is an experimental feature"), { name: "ExperimentalWarning" }));
    expect(original).not.toHaveBeenCalled();

    proc.emitWarning("Something else is experimental", "ExperimentalWarning");
    proc.emitWarning("Buffer() is deprecated", "DeprecationWarning");
    proc.emitWarning(Object.assign(new Error("custom"), { name: "CustomWarning" }));
    expect(original).toHaveBeenCalledTimes(3);
    expect(original.mock.calls[0]).toEqual(["Something else is experimental", "ExperimentalWarning"]);
  });
});
