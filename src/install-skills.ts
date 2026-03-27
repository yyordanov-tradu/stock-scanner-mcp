#!/usr/bin/env node

// Standalone entry point for `npx stock-scanner-install-skills`.
// Needed because npx drops arguments when it needs to download a package first,
// so `npx stock-scanner-mcp install-skills` silently starts the MCP server instead.
// See: https://github.com/yyordanov-tradu/stock-scanner-mcp/issues/148

import { runInstallSkills } from "./skills-installer.js";

await runInstallSkills(process.argv.slice(2));
