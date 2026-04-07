import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { createWorkspaceModule } from "../index.js";
import { ToolResult } from "../../../shared/types.js";

describe("Workspace Tools", () => {
  let tmpDir: string;
  let workspaceTools: any[];
  let getTool: (name: string) => any;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "workspace-tools-test-"));
    const mod = createWorkspaceModule(tmpDir);
    workspaceTools = mod.tools;
    getTool = (name: string) => workspaceTools.find((t) => t.name === name);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("all workspace tools have openWorld: false", () => {
    for (const tool of workspaceTools) {
      expect(tool.openWorld, `${tool.name} missing openWorld: false`).toBe(false);
    }
  });

  it("P2 Fix: tool results include _meta and return parseable JSON", async () => {
    const tool = getTool("workspace_update_profile");
    const result: ToolResult = await tool.handler({
      tradingStyle: "options",
    });

    expect(result.isError).toBeFalsy();
    expect(result._meta).toBeDefined();
    expect(result._meta?.source).toBe("workspace");

    // Must be parseable JSON
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.profile.tradingStyle).toBe("options");
  });

  it("updates profile", async () => {
    const tool = getTool("workspace_update_profile");
    const result: ToolResult = await tool.handler({
      tradingStyle: "options",
      workflowCadence: "weekly",
    });

    expect(result.isError).toBeFalsy();

    const getToolObj = getTool("workspace_get_profile");
    const getResult: ToolResult = await getToolObj.handler({});

    const parsed = JSON.parse(getResult.content[0].text);
    expect(parsed.tradingStyle).toBe("options");
    expect(parsed.workflowCadence).toBe("weekly");
  });

  it("creates and updates watchlist", async () => {
    const createTool = getTool("workspace_create_watchlist");
    await createTool.handler({ name: "core" });

    const updateTool = getTool("workspace_update_watchlist");
    const result: ToolResult = await updateTool.handler({
      name: "core",
      symbols: ["AAPL", "BTC"],
    });

    expect(result.isError).toBeFalsy();

    const listTool = getTool("workspace_list_watchlists");
    const listResult: ToolResult = await listTool.handler({});

    const parsed = JSON.parse(listResult.content[0].text);
    expect(parsed.core.instruments).toHaveLength(2);
    expect(parsed.core.instruments[0].ticker).toBe("AAPL");
    expect(parsed.core.instruments[1].ticker).toBe("BTC");
    expect(parsed.core.instruments[1].isCrypto).toBe(true);
  });

  it("deduplicates instruments by canonical full id", async () => {
    const createTool = getTool("workspace_create_watchlist");
    await createTool.handler({ name: "dedup" });

    const updateTool = getTool("workspace_update_watchlist");
    await updateTool.handler({
      name: "dedup",
      symbols: ["AAPL", "NASDAQ:AAPL", "BTC", "btc"],
    });

    const listTool = getTool("workspace_list_watchlists");
    const listResult: ToolResult = await listTool.handler({});
    const parsed = JSON.parse(listResult.content[0].text);

    expect(parsed.dedup.instruments).toHaveLength(2);
    expect(parsed.dedup.instruments.map((i: any) => i.full)).toEqual(["NASDAQ:AAPL", "BTC"]);
  });

  it("workspace_create_watchlist rejects reserved key __proto__", async () => {
    const tool = getTool("workspace_create_watchlist");
    const result: ToolResult = await tool.handler({ name: "__proto__" });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.message).toContain("reserved");
  });

  it("workspace_update_watchlist rejects reserved key __proto__", async () => {
    const tool = getTool("workspace_update_watchlist");
    const result: ToolResult = await tool.handler({ name: "__proto__", symbols: ["AAPL"] });
    expect(result.isError).toBe(true);
  });

  it("workspace_save_thesis rejects reserved symbol __proto__", async () => {
    const tool = getTool("workspace_save_thesis");
    const result: ToolResult = await tool.handler({ symbol: "__proto__", summary: "test" });
    expect(result.isError).toBe(true);
  });

  it("workspace_get_thesis returns stable JSON shape on hit and miss", async () => {
    const getToolObj = getTool("workspace_get_thesis");

    // MISS case
    const missResult: ToolResult = await getToolObj.handler({ symbol: "IBM" });
    expect(missResult.isError).toBeFalsy();
    const missParsed = JSON.parse(missResult.content[0].text);
    expect(missParsed.found).toBe(false);
    expect(missParsed.symbol).toBe("NASDAQ:IBM");
    expect(missParsed.thesis).toBeNull();

    // HIT case
    const saveTool = getTool("workspace_save_thesis");
    await saveTool.handler({
      symbol: "MARA",
      summary: "Bitcoin proxy play",
    });

    const hitResult: ToolResult = await getToolObj.handler({ symbol: "MARA" });
    expect(hitResult.isError).toBeFalsy();
    const hitParsed = JSON.parse(hitResult.content[0].text);
    expect(hitParsed.found).toBe(true);
    expect(hitParsed.symbol).toBe("NASDAQ:MARA");
    expect(hitParsed.thesis.summary).toBe("Bitcoin proxy play");
  });

  it("workspace_get_profile returns default profile on fresh workspace", async () => {
    const tool = getTool("workspace_get_profile");
    const result: ToolResult = await tool.handler({});

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.defaultExchange).toBe("NASDAQ");
    expect(parsed.workflowCadence).toBe("daily");
    expect(parsed.assetFocus).toEqual([]);
  });

  it("workspace_list_watchlists returns empty object on fresh workspace", async () => {
    const tool = getTool("workspace_list_watchlists");
    const result: ToolResult = await tool.handler({});

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual({});
  });

  it("thesis merge preserves fields not provided in update", async () => {
    const saveTool = getTool("workspace_save_thesis");

    // Save with summary + bullCase
    await saveTool.handler({
      symbol: "NVDA",
      summary: "AI chip leader",
      bullCase: "Data center demand",
    });

    // Update only summary
    await saveTool.handler({
      symbol: "NVDA",
      summary: "AI chip leader v2",
    });

    const getTool2 = getTool("workspace_get_thesis");
    const result: ToolResult = await getTool2.handler({ symbol: "NVDA" });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.thesis.summary).toBe("AI chip leader v2");
    expect(parsed.thesis.bullCase).toBe("Data center demand"); // preserved
  });

  it("workspace_create_watchlist rejects duplicate name", async () => {
    const tool = getTool("workspace_create_watchlist");
    await tool.handler({ name: "core" });

    const result: ToolResult = await tool.handler({ name: "core" });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.message).toContain("already exists");
  });

  it("workspace_update_watchlist rejects non-existent watchlist", async () => {
    const tool = getTool("workspace_update_watchlist");
    const result: ToolResult = await tool.handler({ name: "ghost", symbols: ["AAPL"] });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.message).toContain("does not exist");
  });

  it("all workspace tools have readOnly correctly set", () => {
    const readTools = new Set([
      "workspace_get_profile",
      "workspace_list_watchlists",
      "workspace_get_thesis",
    ]);

    for (const tool of workspaceTools) {
      if (readTools.has(tool.name)) {
        expect(tool.readOnly, `${tool.name} should be readOnly: true`).toBe(true);
      } else {
        expect(tool.readOnly, `${tool.name} should be readOnly: false`).toBe(false);
      }
    }
  });

  it("workspace_create_watchlist schema rejects name exceeding max length", () => {
    const tool = getTool("workspace_create_watchlist");
    const result = tool.inputSchema.safeParse({ name: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("workspace_save_thesis schema rejects summary exceeding max length", () => {
    const tool = getTool("workspace_save_thesis");
    const result = tool.inputSchema.safeParse({ symbol: "AAPL", summary: "x".repeat(5001) });
    expect(result.success).toBe(false);
  });
});
