# Contributing to stock-scanner-mcp

Thanks for your interest in contributing! This guide covers how to get started.

## Development Setup

```bash
git clone https://github.com/yyordanov-tradu/stock-scanner-mcp.git
cd stock-scanner-mcp
npm install
npm run build
npm test
```

## Quality Gates

All PRs must pass before merge:

```bash
npm run lint    # tsc --noEmit
npm test        # vitest
npm run build   # tsup
```

## Making Changes

1. Fork the repo and create a branch from `main`
2. Write your code following existing patterns
3. Add tests for any new or modified functionality — **no exceptions**
4. Ensure all quality gates pass
5. Submit a PR with a clear description

## Module Development

Each module follows the same structure:

```
src/modules/{name}/
  index.ts              # Factory: create{Name}Module()
  client.ts             # HTTP calls + caching
  __tests__/client.test.ts  # Tests
```

Key rules:
- All HTTP calls go through `shared/http.ts` (never raw `fetch`)
- All tool handlers must be wrapped with `withMetadata()`
- Tool names follow `{module}_{action}` convention (e.g., `finnhub_quote`)
- Schema defaults use `.default()` in zod so LLMs see them
- Imports must use `.js` extension (ESM)

## Adding a New Module

1. Create the directory under `src/modules/`
2. Follow the pattern: `index.ts` (factory) + `client.ts` (HTTP + cache) + tests
3. Register the module in `src/registry.ts`
4. Add tool descriptions that are LLM-readable and honest about limitations
5. Update the README with the new tools

## Reporting Issues

Open an issue on GitHub with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- stock-scanner-mcp version (`npm ls stock-scanner-mcp`)

## Code Style

- TypeScript strict mode
- No `any` in new code
- All response types need TypeScript interfaces
- `encodeURIComponent()` for all URL parameters
- API keys via headers, never query params

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
