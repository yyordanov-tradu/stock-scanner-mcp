# Task 3: Shared Types

**Files:**
- Create: `src/shared/types.ts`
- Test: `src/shared/__tests__/types.test.ts`

---

**Step 1: Write the test**

Create `src/shared/__tests__/types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { ModuleDefinition, ToolDefinition, ToolResult } from "../types.js";
import { errorResult, successResult } from "../types.js";

describe("types", () => {
  it("ModuleDefinition shape is valid", () => {
    const mod: ModuleDefinition = {
      name: "test-module",
      description: "A test module",
      requiredEnvVars: ["TEST_KEY"],
      tools: [],
    };
    expect(mod.name).toBe("test-module");
    expect(mod.requiredEnvVars).toEqual(["TEST_KEY"]);
  });

  it("ToolResult success shape", () => {
    const result: ToolResult = {
      content: [{ type: "text", text: "hello" }],
    };
    expect(result.content[0].type).toBe("text");
  });

  it("ToolResult error shape", () => {
    const result: ToolResult = {
      content: [{ type: "text", text: "Error: something failed" }],
      isError: true,
    };
    expect(result.isError).toBe(true);
  });
});

describe("errorResult", () => {
  it("returns error ToolResult", () => {
    const result = errorResult("something broke");
    expect(result.content[0].text).toBe("Error: something broke");
    expect(result.isError).toBe(true);
  });
});

describe("successResult", () => {
  it("returns success ToolResult", () => {
    const result = successResult("data here");
    expect(result.content[0].text).toBe("data here");
    expect(result.isError).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/__tests__/types.test.ts`
Expected: FAIL -- module not found

**Step 3: Write the types**

Create `src/shared/types.ts`:

```typescript
import { z } from "zod";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, z.ZodType>;
  handler: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ModuleDefinition {
  name: string;
  description: string;
  requiredEnvVars: string[];
  tools: ToolDefinition[];
}

export function errorResult(message: string): ToolResult {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

export function successResult(text: string): ToolResult {
  return {
    content: [{ type: "text", text }],
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/types.ts src/shared/__tests__/types.test.ts
git commit -m "feat: add shared types -- ModuleDefinition, ToolDefinition, ToolResult"
```
