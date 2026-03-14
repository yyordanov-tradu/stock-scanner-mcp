import { ToolResult } from "./types.js";

export interface MetadataOptions {
  source: string;
  dataDelay?: string;
}

/**
 * Wraps a tool handler to inject consistent metadata and standardize errors.
 */
export function withMetadata(
  handler: (args: any) => Promise<ToolResult>,
  options: MetadataOptions
) {
  return async (args: any): Promise<ToolResult> => {
    try {
      const result = await handler(args);
      
      // Inject metadata
      result._meta = {
        lastUpdated: new Date().toISOString(),
        source: options.source,
        dataDelay: options.dataDelay,
      };
      
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      
      // Attempt to extract error code
      let code = "INTERNAL_ERROR";
      if (message.includes("HTTP 429")) code = "RATE_LIMITED";
      if (message.includes("HTTP 403")) code = "FORBIDDEN";
      if (message.includes("fetch failed")) code = "FETCH_FAILED";
      if (message.includes("not found")) code = "NOT_FOUND";

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: true,
            code,
            message,
            retryable: code === "RATE_LIMITED" || code === "FETCH_FAILED",
          }, null, 2)
        }],
        isError: true,
        _meta: {
          lastUpdated: new Date().toISOString(),
          source: options.source,
        }
      };
    }
  };
}
