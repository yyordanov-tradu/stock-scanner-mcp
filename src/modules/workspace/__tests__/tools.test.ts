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

  it("saves and gets thesis", async () => {
    const saveTool = getTool("workspace_save_thesis");
    await saveTool.handler({
      symbol: "MARA",
      summary: "Bitcoin proxy play",
      bullCase: "BTC breaks 80k",
    });
    
    const getToolObj = getTool("workspace_get_thesis");
    const result: ToolResult = await getToolObj.handler({ symbol: "MARA" });
    
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.summary).toBe("Bitcoin proxy play");
    expect(parsed.bullCase).toBe("BTC breaks 80k");
  });
});
