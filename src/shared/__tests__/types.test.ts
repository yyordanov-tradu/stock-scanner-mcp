import { describe, it, expect } from "vitest";
import type { ModuleDefinition, ToolResult } from "../types.js";
import { errorResult, successResult } from "../types.js";

describe("types", () => {
  it("ModuleDefinition shape is valid", () => {
    const mod: ModuleDefinition = {
      name: "test-module",
      description: "A test module",
      requiredEnvVars: ["TEST_KEY"],
      tools: [],
    };
    expect(mod.name).toBe("test-module");
    expect(mod.requiredEnvVars).toEqual(["TEST_KEY"]);
  });

  it("ToolResult success shape", () => {
    const result: ToolResult = {
      content: [{ type: "text", text: "hello" }],
    };
    expect(result.content[0].type).toBe("text");
  });

  it("ToolResult error shape", () => {
    const result: ToolResult = {
      content: [{ type: "text", text: '{"error":true}' }],
      isError: true,
    };
    expect(result.isError).toBe(true);
  });
});

describe("errorResult", () => {
  it("returns error ToolResult", () => {
    const result = errorResult("something broke");
    expect(result.isError).toBe(true);
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe(true);
    expect(data.message).toBe("something broke");
  });
});

describe("successResult", () => {
  it("returns success ToolResult", () => {
    const result = successResult("data here");
    expect(result.content[0].text).toBe("data here");
    expect(result.isError).toBeUndefined();
  });
});
