import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve the repo root from this test file (src/__tests__/ -> repo root is two levels up).
// Anchored to import.meta.url (NOT process.cwd()) so it is stable regardless of where vitest runs.
const __testDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__testDir, "..", "..");

function readJson(relPath: string): unknown {
  const abs = path.join(REPO_ROOT, relPath);
  return JSON.parse(fs.readFileSync(abs, "utf-8"));
}

interface PackageJson {
  name: string;
  version: string;
}
interface PluginJson {
  name: string;
  version: string;
}
interface McpServer {
  command: string;
  args: string[];
  env: Record<string, string>;
}
interface McpJson {
  mcpServers: Record<string, McpServer>;
}
interface MarketplacePlugin {
  name: string;
  source: string;
}
interface MarketplaceJson {
  name: string;
  owner: { name: string };
  plugins: MarketplacePlugin[];
}

describe("plugin manifests", () => {
  it("all three manifest files parse as JSON", () => {
    expect(() => readJson("package.json")).not.toThrow();
    expect(() => readJson(".claude-plugin/plugin.json")).not.toThrow();
    expect(() => readJson(".claude-plugin/marketplace.json")).not.toThrow();
    expect(() => readJson(".mcp.json")).not.toThrow();
  });

  it("plugin.json version is in lockstep with package.json version", () => {
    const pkg = readJson("package.json") as PackageJson;
    const plugin = readJson(".claude-plugin/plugin.json") as PluginJson;
    // Sourced dynamically from package.json — never hardcode a version string here.
    expect(typeof pkg.version).toBe("string");
    expect(plugin.version).toBe(pkg.version);
  });

  it("name invariant holds across plugin.json and marketplace.json", () => {
    const plugin = readJson(".claude-plugin/plugin.json") as PluginJson;
    const marketplace = readJson(".claude-plugin/marketplace.json") as MarketplaceJson;
    expect(plugin.name).toBe("stock-scanner");
    expect(marketplace.name).toBe("tradu-marketplace");
    expect(marketplace.plugins.length).toBeGreaterThan(0);
    expect(marketplace.plugins[0].name).toBe("stock-scanner");
    expect(marketplace.plugins[0].name).toBe(plugin.name);
  });

  it("marketplace.json has a required non-empty owner.name", () => {
    const marketplace = readJson(".claude-plugin/marketplace.json") as MarketplaceJson;
    expect(marketplace.owner).toBeDefined();
    expect(typeof marketplace.owner.name).toBe("string");
    expect(marketplace.owner.name.length).toBeGreaterThan(0);
  });

  it("marketplace.json plugin source is exactly './'", () => {
    const marketplace = readJson(".claude-plugin/marketplace.json") as MarketplaceJson;
    expect(marketplace.plugins.length).toBeGreaterThan(0);
    expect(marketplace.plugins[0].source).toBe("./");
  });

  it(".mcp.json starts the server via npx, not a committed dist path", () => {
    const mcp = readJson(".mcp.json") as McpJson;
    const server = mcp.mcpServers["stock-scanner"];
    expect(server).toBeDefined();
    expect(server.command).toBe("npx");
    expect(server.args).toContain("stock-scanner-mcp");
    expect(server.args).toContain("-y");
    // Workspace must stay enabled so plugin users get the full tool set
    // (workspace tools + /setup-market-workspace). Data dir defaults to
    // ~/.stock-scanner-mcp, which is CWD-independent under npx.
    expect(server.args).toContain("--enable-workspace");
    // Negative assertion: the rejected dist/-commit path must never come back.
    expect(server.args).not.toContain("${CLAUDE_PLUGIN_ROOT}/dist/index.js");
    expect(server.args.some((a) => a.includes("dist/index.js"))).toBe(false);
  });

  it(".mcp.json env passthrough is exactly the three optional API keys", () => {
    const mcp = readJson(".mcp.json") as McpJson;
    const env = mcp.mcpServers["stock-scanner"].env;
    expect(new Set(Object.keys(env))).toEqual(
      new Set(["FINNHUB_API_KEY", "ALPHA_VANTAGE_API_KEY", "FRED_API_KEY"]),
    );
    // Each value must be the ${VAR} self-reference form — never a literal secret.
    expect(env.FINNHUB_API_KEY).toBe("${FINNHUB_API_KEY}");
    expect(env.ALPHA_VANTAGE_API_KEY).toBe("${ALPHA_VANTAGE_API_KEY}");
    expect(env.FRED_API_KEY).toBe("${FRED_API_KEY}");
  });
});
