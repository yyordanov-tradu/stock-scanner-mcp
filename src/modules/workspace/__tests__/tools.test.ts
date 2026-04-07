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
});
