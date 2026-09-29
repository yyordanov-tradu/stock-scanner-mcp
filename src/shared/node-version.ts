export const MIN_NODE_FOR_SQLITE = { major: 22, minor: 13 };

export function parseNodeVersion(version: string): { major: number; minor: number } {
  const [major = 0, minor = 0] = version.replace(/^v/, "").split(".").map(Number);
  return { major, minor };
}

export function isSqliteNodeSupported(version = process.versions.node): boolean {
  const { major, minor } = parseNodeVersion(version);
  const min = MIN_NODE_FOR_SQLITE;
  return major > min.major || (major === min.major && minor >= min.minor);
}

export function sqliteNodeRequirementMessage(
  feature: string,
  flag: string,
  version = process.versions.node,
): string | null {
  if (isSqliteNodeSupported(version)) return null;
  const min = MIN_NODE_FOR_SQLITE;
  return (
    `stock-scanner-mcp: ${feature} (${flag}) requires Node.js >= ${min.major}.${min.minor} ` +
    `for the built-in node:sqlite module, but this is Node.js v${version.replace(/^v/, "")}. ` +
    `Continuing without ${feature}; upgrade Node.js to enable it.`
  );
}

// Entry points call this before enabling a node:sqlite-backed feature. Returns false (after
// logging why) when the feature must be skipped, so the rest of the server keeps working —
// the Claude Code plugin hard-codes --enable-workspace and users cannot edit that.
export function checkSqliteNodeSupport(feature: string, flag: string, proc: NodeJS.Process = process): boolean {
  const requirement = sqliteNodeRequirementMessage(feature, flag, proc.versions.node);
  if (requirement) {
    console.error(requirement);
    return false;
  }
  suppressSqliteExperimentalWarning(proc);
  return true;
}

// node:sqlite emits an ExperimentalWarning on load, which would otherwise show up in the
// MCP client's log on every session start. Wrapping emitWarning (rather than replacing the
// "warning" listeners) keeps --no-warnings / --trace-warnings behaviour for everything else.
export function suppressSqliteExperimentalWarning(proc: NodeJS.Process = process): void {
  const original = proc.emitWarning.bind(proc);
  const filtered: NodeJS.Process["emitWarning"] = (warning, ...rest) => {
    const message = typeof warning === "string" ? warning : warning.message;
    const typeArg = rest[0];
    const type =
      typeof warning !== "string"
        ? warning.name
        : typeof typeArg === "string"
          ? typeArg
          : typeof typeArg === "object" && typeArg !== null && "type" in typeArg
            ? String(typeArg.type)
            : undefined;
    if (type === "ExperimentalWarning" && /sqlite/i.test(message)) return;
    (original as (...args: unknown[]) => void)(warning, ...rest);
  };
  proc.emitWarning = filtered;
}
