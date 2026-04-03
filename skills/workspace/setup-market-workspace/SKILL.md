---
name: setup-market-workspace
description: Initialize or update your personalized market workspace (trading style, watchlists, and review cadence).
---

# Setup Market Workspace

## Overview
Use this skill to create or update your core trading profile and initial watchlist. This allows the assistant to remember your context across sessions and provide personalized research routines like the workspace-aware morning brief.

Announce at start: "Setting up your market workspace — I'll ask a few quick questions to get started..."

## Interaction Flow
1. **Questions:** Ask the user these exact three questions in a conversational but efficient way. Do not ask all at once, or ask them together if you prefer, but ensure you get answers for all three:
   - "What kind of trader or investor are you?" (e.g., options trader, swing trader, long-term, crypto-focused).
   - "Which names or assets should I save to your core watchlist first?" (e.g., MARA, AAPL, Gold).
   - "Do you want a daily or weekly market review?" (e.g., Daily).

2. **Resolution:**
   - For ambiguous assets like 'Gold' or 'Silver', ask a follow-up: "For Gold/Silver, do you want spot prices or liquid ETF proxies like GLD/SLV?"
   - Resolve all symbols implicitly to their standard ticker format.

3. **Execution:** Once you have the answers, use the following tools to save the state:
   - Call `workspace_update_profile` to save the trading style and review cadence.
   - Call `workspace_create_watchlist` with `name="core"` (ignore if it returns an error that it already exists).
   - Call `workspace_update_watchlist` with `name="core"` and the array of `symbols` (e.g., `["MARA", "HOOD", "BTC"]`).

## Output
Once finished, summarize the workspace state:
- **Profile:** [Trading Style] | [Review Cadence]
- **Core Watchlist:** [Saved Symbols]
- **Next Steps:** Tell the user: "You're all set. You can now use `/workspace-morning-brief` to get a tailored daily summary based on these names."
