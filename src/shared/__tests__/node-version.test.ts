import { describe, it, expect, vi, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import {
  parseNodeVersion,
  isWorkspaceNodeSupported,
  workspaceNodeRequirementMessage,
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

  it("requires Node >= 22.13 for the workspace module", () => {
    expect(isWorkspaceNodeSupported("20.20.2")).toBe(false);
    expect(isWorkspaceNodeSupported("22.12.9")).toBe(false);
    expect(isWorkspaceNodeSupported("22.13.0")).toBe(true);
    expect(isWorkspaceNodeSupported("23.4.0")).toBe(true);
    expect(isWorkspaceNodeSupported("24.0.0")).toBe(true);
  });

  it("returns a readable requirement message only for unsupported versions", () => {
    expect(workspaceNodeRequirementMessage("22.13.0")).toBeNull();
    const msg = workspaceNodeRequirementMessage("20.20.2");
    expect(msg).toContain("Node.js >= 22.13");
    expect(msg).toContain("v20.20.2");
    expect(msg).toContain("--enable-workspace");
  });

  it("suppresses only the node:sqlite ExperimentalWarning", () => {
    const proc = new EventEmitter() as unknown as NodeJS.Process;
    const originalListener = vi.fn();
    proc.on("warning", originalListener);
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

    suppressSqliteExperimentalWarning(proc);

    const sqlite = Object.assign(new Error("SQLite is an experimental feature and might change at any time"), {
      name: "ExperimentalWarning",
    });
    const other = Object.assign(new Error("Something else is deprecated"), { name: "DeprecationWarning" });
    proc.emit("warning", sqlite);
    proc.emit("warning", other);

    expect(originalListener).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledTimes(1);
    expect(stderr.mock.calls[0][0]).toContain("DeprecationWarning: Something else is deprecated");
  });
});
