import { httpFetch } from "../../shared/http.js";

/**
 * Yahoo Finance session manager.
 *
 * Yahoo's v7/v8 API endpoints require a crumb token + session cookie.
 * Flow:
 *   1. GET https://fc.yahoo.com/curveball → extracts "A3" cookie from Set-Cookie
 *   2. GET https://query1.finance.yahoo.com/v1/test/getcrumb (with cookie) → crumb string
 *   3. Append ?crumb=<crumb> to API calls and pass Cookie header
 *
 * Session is cached and refreshed on 401 or after 30 minutes.
 */

const COOKIE_URL = "https://fc.yahoo.com/curveball";
const CRUMB_URL = "https://query1.finance.yahoo.com/v1/test/getcrumb";
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes
const TIMEOUT_MS = 10_000;
const RATE_LIMIT_COOLDOWN = 5 * 60 * 1000; // 5 minutes lockout on 429

export const YAHOO_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface YahooSession {
  cookie: string;
  crumb: string;
  createdAt: number;
}

let session: YahooSession | null = null;
let sessionPromise: Promise<YahooSession> | null = null;
let lastRateLimitTime = 0;

async function createSession(): Promise<YahooSession> {
  // Prevent retries during cooldown period
  const now = Date.now();
  if (now - lastRateLimitTime < RATE_LIMIT_COOLDOWN) {
    const remaining = Math.ceil((RATE_LIMIT_COOLDOWN - (now - lastRateLimitTime)) / 1000);
    throw new Error(`Yahoo Finance rate limit cooldown active. Please wait ${remaining}s.`);
  }

  const controller1 = new AbortController();
  const timer1 = setTimeout(() => controller1.abort(), TIMEOUT_MS);

  let cookie: string;
  try {
    const cookieResp = await httpFetch(COOKIE_URL, {
      method: "GET",
      headers: { 
        "User-Agent": YAHOO_USER_AGENT,
        "Accept": "*/*",
      },
      redirect: "manual",
      signal: controller1.signal,
    });
    
    // Extract A3 cookie from Set-Cookie header
    const headers = cookieResp.headers;
    let setCookie: string[] = [];
    if (headers) {
      if (typeof (headers as any).getSetCookie === "function") {
        setCookie = (headers as any).getSetCookie();
      } else if (typeof headers.get === "function") {
        const val = headers.get("set-cookie");
        if (val) setCookie = [val];
      }
    }

    const a3 = setCookie
      .map(c => c.split(";")[0])
      .find(c => c.startsWith("A3="));
    if (!a3) {
      throw new Error("Yahoo session: failed to obtain A3 cookie");
    }
    cookie = a3;
  } finally {
    clearTimeout(timer1);
  }

  const controller2 = new AbortController();
  const timer2 = setTimeout(() => controller2.abort(), TIMEOUT_MS);

  let crumb: string;
  try {
    const crumbResp = await httpFetch(CRUMB_URL, {
      method: "GET",
      headers: {
        "User-Agent": YAHOO_USER_AGENT,
        "Cookie": cookie,
        "Referer": "https://finance.yahoo.com",
        "Accept": "*/*",
      },
      signal: controller2.signal,
    });

    if (crumbResp.status === 429) {
      lastRateLimitTime = Date.now();
      throw new Error("Yahoo session: IP rate limited (429). Cooling down for 5 minutes.");
    }

    if (!crumbResp.ok) {
      throw new Error(`Yahoo session: crumb request failed (${crumbResp.status})`);
    }
    crumb = await crumbResp.text();
    if (!crumb || crumb.includes("Too Many") || crumb.includes("error")) {
      if (crumb.includes("Too Many")) lastRateLimitTime = Date.now();
      throw new Error(`Yahoo session: invalid crumb response: ${crumb.slice(0, 100)}`);
    }
  } finally {
    clearTimeout(timer2);
  }

  return { cookie, crumb, createdAt: Date.now() };
}

function isExpired(s: YahooSession): boolean {
  return Date.now() - s.createdAt > SESSION_TTL;
}

export async function getSession(): Promise<YahooSession> {
  if (session && !isExpired(session)) {
    return session;
  }
  // Deduplicate concurrent init calls
  if (!sessionPromise) {
    sessionPromise = createSession().then(s => {
      session = s;
      sessionPromise = null;
      return s;
    }).catch(err => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

/** Force refresh on next call (e.g. after a 401). */
export function invalidateSession(): void {
  session = null;
  sessionPromise = null;
}

/**
 * Get headers for a Yahoo Finance API call using the current session.
 */
export async function getYahooHeaders(): Promise<Record<string, string>> {
  const sess = await getSession();
  return {
    "User-Agent": YAHOO_USER_AGENT,
    "Cookie": sess.cookie,
    "Referer": "https://finance.yahoo.com",
    "Accept": "*/*",
  };
}

/**
 * Build a Yahoo Finance API URL with the crumb parameter appended.
 */
export async function appendCrumb(url: string): Promise<string> {
  const sess = await getSession();
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}crumb=${encodeURIComponent(sess.crumb)}`;
}
