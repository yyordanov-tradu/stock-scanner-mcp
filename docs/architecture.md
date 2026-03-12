# Architecture Diagram

This diagram illustrates how Claude Code, the LLM, the MCP Server, and the 19 tools connect to external data sources in this project.

```text
       USER
         │
         ▼
┌───────────────────┐        ┌───────────────────┐
│    CLAUDE CODE    │ <────> │        LLM        │ (The Brain)
│   (The Client)    │        │ (Claude 3.5/Opus) │ Decides WHICH tool to use
└─────────┬─────────┘        └───────────────────┘
          │
          │ (Model Context Protocol - MCP)
          │ The "Universal Wire" connecting the Brain to Data
          │
┌─────────▼──────────────────────────────────────┐
│             STOCK SCANNER PLUGIN               │ (The "Package")
│  ┌──────────────────────────────────────────┐  │
│  │               MCP SERVER                 │  │ (The "Engine")
│  │      (Host for your 19 Tools)            │  │
│  └────┬───────────────┬───────────────┬─────┘  │
│       │               │               │        │
│  ┌────▼────┐    ┌─────▼────┐    ┌─────▼────┐   │
│  │ TOOL 01 │    │ TOOL 02  │    │ TOOL 19  │   │ (The "Skills")
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
