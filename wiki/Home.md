# stock-scanner-mcp Wiki

A modular MCP server that gives Claude Code real-time access to stock and crypto market data. Scan markets, check technicals, monitor insider trades, analyze options flow, track earnings and economic events — all from your terminal.

**47 tools** across **9 modules** — 6 modules work with zero API keys.

## Pages

- **[Installation & Setup](Installation-&-Setup)** — Get running in 2 minutes
- **[Tool Reference](Tool-Reference)** — Complete reference for all 47 tools
- **[Example Prompts](Example-Prompts)** — Copy-paste prompts for common workflows
- **[Advanced Strategies](Advanced-Strategies)** — Multi-tool analysis chains for serious research
- **[API Keys & Rate Limits](API-Keys-&-Rate-Limits)** — Free tier limits, caching, and best practices
- **[FAQ & Troubleshooting](FAQ-&-Troubleshooting)** — Common issues and solutions

## Quick Start

```json
{
  "mcpServers": {
    "stock-scanner": {
      "command": "npx",
      "args": ["-y", "stock-scanner-mcp"]
    }
  }
}
```

Then just ask Claude:

> "What are the top gaining stocks today?"

That's it. 29 tools work immediately with no API keys.
