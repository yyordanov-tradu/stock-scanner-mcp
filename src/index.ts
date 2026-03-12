#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseConfig } from "./config.js";
import { resolveEnabledModules } from "./registry.js";
import type { ModuleDefinition } from "./shared/types.js";

// Modules will be imported here as they are built
// import { createTradingviewModule } from "./modules/tradingview/index.js";

function buildModules(_defaultExchange: string): ModuleDefinition[] {
  return [
    // Modules added here as implemented
  ];
}

async function main() {
  const config = parseConfig(process.argv.slice(2));
  const allModules = buildModules(config.defaultExchange);
  const enabled = resolveEnabledModules(allModules, config.env, config.enabledModules);

  const server = new McpServer({
    name: "stock-scanner",
    version: "0.1.0",
  });

  for (const mod of enabled) {
    for (const tool of mod.tools) {
      server.registerTool(tool.name, {
        description: tool.description,
        inputSchema: tool.inputSchema,
      }, async (params) => {
        try {
          return await tool.handler(params as Record<string, unknown>);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      });
    }
    console.error(`Registered ${mod.tools.length} tools from ${mod.name}`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `stock-scanner MCP server running -- ${enabled.length} modules, ` +
    `${enabled.reduce((n, m) => n + m.tools.length, 0)} tools`,
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
