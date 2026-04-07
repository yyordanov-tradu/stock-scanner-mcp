import { z } from "zod";

export const SEC_USER_AGENT = "StockScanner contact@example.com";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  _meta?: {
    lastUpdated: string;
    source: string;
    dataDelay?: string;
  };
  [key: string]: unknown; // Index signature for MCP compatibility
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
  readOnly: boolean;
  openWorld?: boolean;
  handler: (args: any) => Promise<ToolResult>;
}

export interface ModuleDefinition {
  name: string;
  description: string;
  requiredEnvVars: string[];
  tools: ToolDefinition[];
}

export function errorResult(message: string, code = "INTERNAL_ERROR"): ToolResult {
  return {
    content: [{ 
      type: "text", 
      text: JSON.stringify({
        error: true,
        code,
        message,
      }, null, 2)
    }],
    isError: true,
  };
}

export function successResult(text: string): ToolResult {
  return {
    content: [{ type: "text", text }],
  };
}
