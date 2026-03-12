import { describe, it, expect } from "vitest";
import { parseConfig } from "../config.js";
import { resolveEnabledModules } from "../registry.js";
import type { ModuleDefinition, ToolDefinition } from "../shared/types.js";
import { successResult } from "../shared/types.js";
import { z } from "zod";

describe("server module wiring", () => {
  const mockTool: ToolDefinition = {
    name: "test_tool",
    description: "A test tool",
    inputSchema: { symbol: z.string() },
    handler: async () => successResult("ok"),
  };

  const mockModule: ModuleDefinition = {
    name: "test-mod",
    description: "Test",
    requiredEnvVars: [],
    tools: [mockTool],
  };

  it("registers tools from enabled modules", () => {
    const config = parseConfig([]);
    const enabled = resolveEnabledModules([mockModule], config.env);
    const tools = enabled.flatMap((m) => m.tools);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("test_tool");
  });

  it("wraps tool handler errors into error results", async () => {
    const failingTool: ToolDefinition = {
      name: "fail_tool",
      description: "Fails",
      inputSchema: {},
      handler: async () => { throw new Error("boom"); },
    };

    try {
      await failingTool.handler({});
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe("boom");
    }
  });
});
