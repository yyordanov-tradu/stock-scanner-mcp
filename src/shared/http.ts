export interface HttpOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  responseType?: "json" | "text";
}

const DEFAULT_TIMEOUT_MS = 10_000;

const SENSITIVE_PARAMS = /([?&])(apikey|api_key|token|secret|key)=[^&]*/gi;

const DEFAULT_HEADERS = {
  "User-Agent": "stock-scanner-mcp/0.1.0 (+https://github.com/yyordanov-tradu/stock-scanner-mcp)",
};

function sanitizeUrl(url: string): string {
  return url.replace(SENSITIVE_PARAMS, "$1$2=REDACTED");
}

function sanitizeError(err: unknown): Error {
  if (err instanceof Error) {
    const sanitized = new Error(sanitizeUrl(err.message));
    sanitized.stack = err.stack;
    return sanitized;
  }
  return new Error(sanitizeUrl(String(err)));
}

export async function httpPost<T = unknown>(
  url: string,
  body: unknown,
  options: HttpOptions = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...DEFAULT_HEADERS,
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `HTTP ${response.status}: ${response.statusText} -- ${text.slice(0, 200)}`,
      );
    }

    return (await response.json()) as T;
  } catch (err) {
    throw sanitizeError(err);
  } finally {
    clearTimeout(timer);
  }
}

export async function httpGet<T = unknown>(
  url: string,
  options: HttpOptions = {},
): Promise<T> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers = {},
    responseType = "json",
  } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...DEFAULT_HEADERS,
        ...headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `HTTP ${response.status}: ${response.statusText} -- ${text.slice(0, 200)}`,
      );
    }

    if (responseType === "text") {
      return (await response.text()) as T;
    }
    return (await response.json()) as T;
  } catch (err) {
    throw sanitizeError(err);
  } finally {
    clearTimeout(timer);
  }
}

export async function httpFetch(
  url: string | URL | globalThis.Request,
  init?: RequestInit
): Promise<Response> {
  return fetch(url, init);
}
