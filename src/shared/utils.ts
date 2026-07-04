import { ToolResult } from "./types.js";
import { classifyError } from "./errors.js";

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
      const classified = classifyError(err);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: true,
            code: classified.code,
            message: classified.original.message,
            retryable: classified.retryable,
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
