export const MIN_NODE_FOR_WORKSPACE = { major: 22, minor: 13 };

export function parseNodeVersion(version: string): { major: number; minor: number } {
  const [major = 0, minor = 0] = version.replace(/^v/, "").split(".").map(Number);
  return { major, minor };
}

export function isWorkspaceNodeSupported(version = process.versions.node): boolean {
  const { major, minor } = parseNodeVersion(version);
  const min = MIN_NODE_FOR_WORKSPACE;
  return major > min.major || (major === min.major && minor >= min.minor);
}

export function workspaceNodeRequirementMessage(version = process.versions.node): string | null {
  if (isWorkspaceNodeSupported(version)) return null;
  const min = MIN_NODE_FOR_WORKSPACE;
  return (
    `stock-scanner-mcp: the workspace module (--enable-workspace) requires Node.js >= ${min.major}.${min.minor} ` +
    `for the built-in node:sqlite module, but this is Node.js v${version.replace(/^v/, "")}. ` +
    `Upgrade Node.js or start without --enable-workspace.`
  );
}

// node:sqlite emits an ExperimentalWarning on load; it would otherwise appear in the
// MCP client's log on every session start. Other warnings are still printed.
export function suppressSqliteExperimentalWarning(proc: NodeJS.Process = process): void {
  proc.removeAllListeners("warning");
  proc.on("warning", (warning: Error) => {
    if (warning.name === "ExperimentalWarning" && /sqlite/i.test(warning.message)) return;
    console.error(`(node) ${warning.name}: ${warning.message}`);
  });
}
