export interface Config {
  defaultExchange: string;
  enabledModules?: string[];
  env: Record<string, string | undefined>;
}

export function parseConfig(args: string[]): Config {
  let defaultExchange = "NASDAQ";
  let enabledModules: string[] | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--default-exchange" && args[i + 1]) {
      defaultExchange = args[i + 1];
      i++;
    } else if (args[i] === "--modules" && args[i + 1]) {
      enabledModules = args[i + 1].split(",").map((m) => m.trim());
      i++;
    }
  }

  return {
    defaultExchange,
    enabledModules,
    env: {
      FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,
      ALPHA_VANTAGE_API_KEY: process.env.ALPHA_VANTAGE_API_KEY,
      FRED_API_KEY: process.env.FRED_API_KEY,
    },
  };
}
