import { requiredEnv } from "@/src/lib/env";
import type { SessionData } from "@/src/lib/session";

const STRAVA_API_BASE = "https://www.strava.com/api/v3";
const STRAVA_OAUTH_TOKEN_URL = "https://www.strava.com/oauth/token";

export type RateLimitSnapshot = {
  rateLimitLimit?: string;
  rateLimitUsage?: string;
  readRateLimitLimit?: string;
  readRateLimitUsage?: string;
};

export function parseRateLimitHeaders(h: Headers): RateLimitSnapshot {
  return {
    rateLimitLimit: h.get("x-ratelimit-limit") ?? undefined,
    rateLimitUsage: h.get("x-ratelimit-usage") ?? undefined,
    readRateLimitLimit: h.get("x-readratelimit-limit") ?? undefined,
    readRateLimitUsage: h.get("x-readratelimit-usage") ?? undefined,
  };
}

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
  scope?: string;
  athlete?: unknown;
};

function clientId() {
  return requiredEnv("STRAVA_CLIENT_ID");
}
function clientSecret() {
  return requiredEnv("STRAVA_CLIENT_SECRET");
}

export async function exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    code,
    grant_type: "authorization_code",
  });

  const res = await fetch(STRAVA_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Strava token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(STRAVA_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Strava refresh failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function ensureFreshSession(
  session: SessionData,
): Promise<{ session: SessionData; refreshed: boolean }> {
  const now = Math.floor(Date.now() / 1000);
  const needsRefresh = session.strava.expiresAt - now <= 60;
  if (!needsRefresh) return { session, refreshed: false };

  const refreshed = await refreshAccessToken(session.strava.refreshToken);
  return {
    refreshed: true,
    session: {
      ...session,
      strava: {
        ...session.strava,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt: refreshed.expires_at,
      },
    },
  };
}

type StravaRequestOptions = {
  timeoutMs?: number;
};

export async function stravaGetJson<T>(
  path: string,
  accessToken: string,
  options: StravaRequestOptions = {},
): Promise<{ data: T; rateLimit: RateLimitSnapshot }> {
  const controller = options.timeoutMs ? new AbortController() : null;
  const timeoutId =
    controller && options.timeoutMs != null
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : null;

  let res: Response;
  try {
    res = await fetch(`${STRAVA_API_BASE}${path}`, {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: controller?.signal,
    });
  } catch (err) {
    if (controller?.signal.aborted) {
      const timeoutErr = new Error("Strava request timed out") as Error & {
        status?: number;
      };
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const rateLimit = parseRateLimitHeaders(res.headers);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Strava request failed (${res.status}): ${text}`) as Error & {
      status?: number;
      rateLimit?: RateLimitSnapshot;
    };
    err.status = res.status;
    err.rateLimit = rateLimit;
    throw err;
  }

  return { data: (await res.json()) as T, rateLimit };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorStatus(err: unknown): number | null {
  if (!isRecord(err)) return null;
  const status = err.status;
  return typeof status === "number" ? status : null;
}

export async function stravaGetJsonWithRefresh<T>(
  path: string,
  session: SessionData,
  options: StravaRequestOptions = {},
): Promise<{ data: T; rateLimit: RateLimitSnapshot; session: SessionData; refreshed: boolean }> {
  try {
    const { data, rateLimit } = await stravaGetJson<T>(
      path,
      session.strava.accessToken,
      options,
    );
    return { data, rateLimit, session, refreshed: false };
  } catch (err: unknown) {
    if (errorStatus(err) !== 401) throw err;
    const refreshed = await refreshAccessToken(session.strava.refreshToken);
    const refreshedSession: SessionData = {
      ...session,
      strava: {
        ...session.strava,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt: refreshed.expires_at,
      },
    };
    const { data, rateLimit } = await stravaGetJson<T>(
      path,
      refreshedSession.strava.accessToken,
      options,
    );
    return { data, rateLimit, session: refreshedSession, refreshed: true };
  }
}

