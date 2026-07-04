export interface ClassifiedError {
  code: "RATE_LIMITED" | "FETCH_FAILED" | "NOT_FOUND" | "INTERNAL_ERROR" | "FORBIDDEN";
  retryable: boolean;
  original: Error;
}

export function classifyError(err: unknown): ClassifiedError {
  const message = err instanceof Error ? err.message : String(err);
  const original = err instanceof Error ? err : new Error(message);

  if (message.includes("HTTP 429") || message.includes("Rate Limit"))
    return { code: "RATE_LIMITED", retryable: true, original };
  if (message.includes("fetch failed") || message.includes("ETIMEDOUT") || message.includes("timeout"))
    return { code: "FETCH_FAILED", retryable: true, original };
  if (message.includes("not found") || message.includes("HTTP 404"))
    return { code: "NOT_FOUND", retryable: false, original };
  if (message.includes("HTTP 403"))
    return { code: "FORBIDDEN", retryable: false, original };

  return { code: "INTERNAL_ERROR", retryable: false, original };
}
