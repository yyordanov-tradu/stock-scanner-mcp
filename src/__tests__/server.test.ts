import { describe, it, expect } from "vitest";
import { parseConfig } from "../config.js";
import { resolveEnabledModules } from "../registry.js";
import type { ModuleDefinition, ToolDefinition } from "../shared/types.js";
import { successResult } from "../shared/types.js";
import { withMetadata } from "../shared/utils.js";
import { z } from "zod";

describe("server module wiring", () => {
  const mockTool: ToolDefinition = {
    name: "test_tool",
    description: "A test tool",
    inputSchema: z.object({ symbol: z.string() }),
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

  it("withMetadata wrapper adds _meta and standardizes errors", async () => {
    const handler = async () => successResult("ok");
    const wrapped = withMetadata(handler, { source: "test-src", dataDelay: "1s" });
    
    const res = await wrapped({});
    expect(res._meta).toBeDefined();
    expect(res._meta?.source).toBe("test-src");
    expect(res._meta?.dataDelay).toBe("1s");
    expect(res._meta?.lastUpdated).toBeDefined();

    const failingHandler = async () => { throw new Error("fetch failed"); };
    const wrappedFail = withMetadata(failingHandler, { source: "fail-src" });
    const failRes = await wrappedFail({});
    
    expect(failRes.isError).toBe(true);
    const errorData = JSON.parse(failRes.content[0].text);
    expect(errorData.error).toBe(true);
    expect(errorData.code).toBe("FETCH_FAILED");
    expect(errorData.retryable).toBe(true);
    expect(failRes._meta?.source).toBe("fail-src");
  });
});
