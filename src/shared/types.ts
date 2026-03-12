import { z } from "zod";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown; // Index signature for MCP compatibility
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
