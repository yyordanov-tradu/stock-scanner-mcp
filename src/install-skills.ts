#!/usr/bin/env node

// Standalone entry point for `npx -p stock-scanner-mcp stock-scanner-install-skills`.
// Needed because npx drops arguments when it needs to download a package first,
// so `npx stock-scanner-mcp install-skills` silently starts the MCP server instead.
// See: https://github.com/yyordanov-tradu/stock-scanner-mcp/issues/148

import { runInstallSkills } from "./skills-installer.js";

runInstallSkills(process.argv.slice(2)).catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
