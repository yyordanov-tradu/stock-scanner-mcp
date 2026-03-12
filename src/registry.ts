import type { ModuleDefinition } from "./shared/types.js";

export function resolveEnabledModules(
  allModules: ModuleDefinition[],
  env: Record<string, string | undefined>,
  filter?: string[],
): ModuleDefinition[] {
  return allModules.filter((mod) => {
    if (filter && !filter.includes(mod.name)) return false;

    const hasKeys = mod.requiredEnvVars.every((key) => env[key]);
    if (!hasKeys) {
      console.error(`${mod.name}: disabled -- missing ${mod.requiredEnvVars.join(", ")}`);
      return false;
    }

    console.error(`${mod.name}: enabled`);
    return true;
  });
}
