import * as path from "node:path";
import * as os from "node:os";

export interface Config {
  defaultExchange: string;
  enableWorkspace: boolean;
  dataDir?: string;
  enabledModules?: string[];
  env: Record<string, string | undefined>;
}

export function parseConfig(args: string[]): Config {
  let defaultExchange = "NASDAQ";
  let enabledModules: string[] | undefined;
  let enableWorkspace = false;
  let dataDir: string | undefined = process.env.STOCK_SCANNER_DATA_DIR;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--default-exchange" && args[i + 1]) {
      defaultExchange = args[i + 1];
      i++;
    } else if (args[i] === "--modules" && args[i + 1]) {
      enabledModules = args[i + 1].split(",").map((m) => m.trim());
      i++;
    } else if (args[i] === "--enable-workspace") {
      enableWorkspace = true;
    } else if (args[i] === "--data-dir" && args[i + 1]) {
      dataDir = args[i + 1];
      i++;
    }
  }

  if (enableWorkspace && dataDir) {
    const resolved = path.resolve(dataDir);
    const home = os.homedir();
    if (!resolved.startsWith(home + path.sep) && resolved !== home) {
      throw new Error(`--data-dir must be under the user home directory (${home}). Got: ${resolved}`);
    }
    dataDir = resolved;
  }

  return {
    defaultExchange,
    enableWorkspace,
    dataDir,
    enabledModules,
    env: {
      FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,
      ALPHA_VANTAGE_API_KEY: process.env.ALPHA_VANTAGE_API_KEY,
      FRED_API_KEY: process.env.FRED_API_KEY,
    },
  };
}
