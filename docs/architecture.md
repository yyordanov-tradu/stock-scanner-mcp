# Architecture Diagram

This diagram illustrates how Claude Code, the LLM, the MCP Server, and the **54 tools across 11 modules** connect to external data sources in this project.

```text
       USER
         │
         ▼
┌───────────────────┐        ┌───────────────────┐
│    CLAUDE CODE    │ <────> │        LLM        │ (The Brain)
│   (The Client)    │        │   (Claude model)  │ Decides WHICH tool to use
└─────────┬─────────┘        └───────────────────┘
          │
          │ (Model Context Protocol - MCP)
          │ The "Universal Wire" connecting the Brain to Data
          │
┌─────────▼──────────────────────────────────────┐
│             STOCK SCANNER MCP SERVER           │ (The "Package")
│  ┌──────────────────────────────────────────┐  │
│  │               MCP SERVER                 │  │ (The "Engine")
│  │   (Host for 54 tools in 11 modules)      │  │
│  └────┬───────────────┬───────────────┬─────┘  │
│       │               │               │        │
│  ┌────▼────┐    ┌─────▼────┐    ┌─────▼────┐   │
│  │ TOOL 01 │    │ TOOL 02  │    │ TOOL 54  │   │ (The "Skills")
│  │ (Scan)   │    │ (Quote)  │    │ (News)   │   │
│  └────┬────┘    └─────┬────┘    └─────┬────┘   │
└───────┼───────────────┼───────────────┼────────┘
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ TradingView  │ │  SEC EDGAR   │ │   Finnhub    │ (SOURCE SYSTEMS)
│     API      │ │     API      │ │     API      │ External Data
└──────────────┘ └──────────────┘ └──────────────┘
```
