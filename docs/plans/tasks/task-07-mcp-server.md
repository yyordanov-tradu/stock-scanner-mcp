# Task 7: MCP Server Entry Point

**Files:**
- Create: `src/index.ts`
- Create: `.mcp.json`
- Test: `src/__tests__/server.test.ts`

---

**Step 1: Write the test**

Create `src/__tests__/server.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/server.test.ts`
Expected: PASS (this test only verifies wiring logic using existing modules, no new code needed yet)

**Step 3: Write the MCP server entry point**

Create `src/index.ts`:

```typescript
#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseConfig } from "./config.js";
import { resolveEnabledModules } from "./registry.js";
import type { ModuleDefinition } from "./shared/types.js";

// Modules will be imported here as they are built
// import { createTradingviewModule } from "./modules/tradingview/index.js";

function buildModules(defaultExchange: string): ModuleDefinition[] {
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
```

**Step 4: Create plugin .mcp.json**

Create `.mcp.json`:

```json
{
  "stock-scanner": {
    "command": "node",
    "args": ["${CLAUDE_PLUGIN_ROOT}/dist/index.js"],
    "env": {
      "FINNHUB_API_KEY": "${FINNHUB_API_KEY}",
      "ALPHA_VANTAGE_API_KEY": "${ALPHA_VANTAGE_API_KEY}"
    }
  }
}
```

**Step 5: Build and verify**

Run: `npm run build`
Expected: `dist/index.js` created without errors

**Step 6: Smoke test**

Run: `echo '{}' | timeout 3 node dist/index.js 2>&1 || true`
Expected: stderr includes "stock-scanner MCP server running -- 0 modules, 0 tools"

**Step 7: Commit**

```bash
git add src/index.ts src/__tests__/server.test.ts .mcp.json
git commit -m "feat: add MCP server entry point with tool registration and error wrapping"
```
