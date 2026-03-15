import { describe, it, expect } from "vitest";
import { createOptionsModule } from "../index.js";

describe("createOptionsModule", () => {
  it("returns module with 4 tools and requires TRADIER_API_TOKEN", () => {
    const mod = createOptionsModule("test-token");
    expect(mod.name).toBe("options");
    expect(mod.requiredEnvVars).toEqual(["TRADIER_API_TOKEN"]);
    expect(mod.tools).toHaveLength(4);
    expect(mod.tools.map(t => t.name)).toEqual([
      "options_chain",
      "options_expirations",
      "options_unusual_activity",
      "options_max_pain",
    ]);
  });
});
