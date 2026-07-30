import { requiredEnv } from "@/src/lib/env";
import type { SessionData } from "@/src/lib/session";

const STRAVA_API_BASE = "https://www.strava.com/api/v3";
const STRAVA_OAUTH_TOKEN_URL = "https://www.strava.com/oauth/token";
const DEFAULT_TIMEOUT_MS = 15_000;

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

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      const timeoutErr = new Error("Strava request timed out") as Error & {
        status?: number;
      };
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    code,
    grant_type: "authorization_code",
  });

  const res = await fetchWithTimeout(
    STRAVA_OAUTH_TOKEN_URL,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    },
    DEFAULT_TIMEOUT_MS,
  );

  if (!res.ok) {
    throw new Error(`Strava token exchange failed (${res.status})`);
  }
  return (await res.json()) as TokenResponse;
}

/** In-flight refresh promises keyed by the refresh token being used. */
const refreshInFlight = new Map<string, Promise<TokenResponse>>();

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetchWithTimeout(
    STRAVA_OAUTH_TOKEN_URL,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    },
    DEFAULT_TIMEOUT_MS,
  );

  if (!res.ok) {
    const err = new Error(`Strava refresh failed (${res.status})`) as Error & {
      status?: number;
    };
    err.status = res.status === 400 || res.status === 401 ? 401 : res.status;
    throw err;
  }
  return (await res.json()) as TokenResponse;
}

/** Serialize refresh by token so concurrent requests share one rotation. */
export async function refreshAccessTokenSerialized(
  refreshToken: string,
): Promise<TokenResponse> {
  const existing = refreshInFlight.get(refreshToken);
  if (existing) return existing;

  const promise = refreshAccessToken(refreshToken).finally(() => {
    refreshInFlight.delete(refreshToken);
  });
  refreshInFlight.set(refreshToken, promise);
  return promise;
}

export async function ensureFreshSession(
  session: SessionData,
): Promise<{ session: SessionData; refreshed: boolean }> {
  const now = Math.floor(Date.now() / 1000);
  const needsRefresh = session.strava.expiresAt - now <= 60;
  if (!needsRefresh) return { session, refreshed: false };

  const refreshed = await refreshAccessTokenSerialized(session.strava.refreshToken);
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
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const res = await fetchWithTimeout(
    `${STRAVA_API_BASE}${path}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
    timeoutMs,
  );

  const rateLimit = parseRateLimitHeaders(res.headers);

  if (!res.ok) {
    const err = new Error(`Strava request failed (${res.status})`) as Error & {
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

    let refreshedSession: SessionData;
    try {
      const refreshed = await refreshAccessTokenSerialized(session.strava.refreshToken);
      refreshedSession = {
        ...session,
        strava: {
          ...session.strava,
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token,
          expiresAt: refreshed.expires_at,
        },
      };
    } catch {
      const authErr = new Error("Unauthorized.") as Error & { status?: number };
      authErr.status = 401;
      throw authErr;
    }

    try {
      const { data, rateLimit } = await stravaGetJson<T>(
        path,
        refreshedSession.strava.accessToken,
        options,
      );
      return { data, rateLimit, session: refreshedSession, refreshed: true };
    } catch (retryErr: unknown) {
      // Token was rotated; callers must persist the new session even if the resource call failed.
      if (isRecord(retryErr)) {
        retryErr.updatedSession = refreshedSession;
        retryErr.refreshed = true;
      }
      throw retryErr;
    }
  }
}
