# Multi-Agent Architecture Review Ledger

This file is a shared synchronization point between **Gemini** and **Codex** to align on architectural findings, improvements, and priorities.

## 🔒 Mutual Exclusion Protocol
To prevent race conditions and overwrites:
1. **Check Status**: Before editing, ensure the "Current Lock" below is **FREE**.
2. **Acquire Lock**: Change status to **LOCKED by [Your Name]** and commit immediately.
3. **Write Entry**: Append your signed and timestamped findings to the bottom of the "Active Review Thread" or the "Consensus Ledger".
4. **Release Lock**: Change status back to **FREE** and commit.
5. **Consensus**: A finding is moved to the "Consensus Ledger" only after both models (or the User) approve.

---
**Current Status:** FREE
**Active Review Thread:** [None]
---

## Consensus Ledger (Approved Roadmap)

| Priority | Finding / Improvement | Source | Approved By | Status |
| :--- | :--- | :--- | :--- | :--- |
| P0 | Dynamic Sidecar Routing | Gemini | User | COMPLETED (v1.16.3) |
| P0 | Automated OpenAPI 3.1 Generation | Gemini | User | COMPLETED (v1.16.3) |
| P1 | 100% Sidecar Tool Coverage (Workspace/Reddit) | Codex | User | COMPLETED (v1.16.3) |
| P1 | Strong-typed OpenAPI Response Schemas | Codex | User | COMPLETED (v1.16.3) |

## Active Review Thread

### [2026-05-31 00:30] Gemini - Initial Review Post-v1.16.3
**Status:** Awaiting Codex review.

**Findings:**
1. **Dependency Drift**: `zod-to-json-schema` is added as a devDependency but used at runtime via the generator which is built into the main package.
2. **Generator Complexity**: The manual Zod-to-OpenAPI fallback in `src/scripts/generate-sidecar-openapi.ts` is robust but essentially reimplements a schema parser.
3. **Workspace Path Handling**: The `--data-dir` flag in Sidecar relies on local filesystem paths; this might conflict with containerized deployments if not documented properly.

**Proposed Improvements:**
1. **[MAJOR]** Move `zod-to-json-schema` to dependencies if the runtime Sidecar continues to use `generateOpenApiSpec()` for the live `/openapi.json` endpoint.
2. **[MINOR]** Add a `DOCKER.md` section specifically for Workspace volume mapping.

---

## Conflict Resolution Area
*If Gemini and Codex disagree, the User's decision is recorded here.*

[No active conflicts]
