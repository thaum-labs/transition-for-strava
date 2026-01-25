import { cookies } from "next/headers";
import { EncryptJWT, jwtDecrypt } from "jose";
import { createHash, randomBytes } from "node:crypto";
import { isProd, requiredEnv } from "@/src/lib/env";

const SESSION_COOKIE = "pp_session";
const OAUTH_STATE_COOKIE = "pp_oauth_state";
const CSRF_COOKIE = "pp_csrf";

export type SessionData = {
  strava: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // epoch seconds
    scope?: string;
  };
};

function cookieBaseOptions() {
  return {
    path: "/",
    sameSite: "lax" as const,
    secure: isProd(),
  };
}

function deriveKey(): Uint8Array {
  const secret = requiredEnv("SESSION_SECRET");
  return createHash("sha256").update(secret).digest();
}

async function encryptSession(session: SessionData): Promise<string> {
  const key = deriveKey();
  return await new EncryptJWT(session)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .encrypt(key);
}

async function decryptSession(token: string): Promise<SessionData | null> {
  const key = deriveKey();
  try {
    const { payload } = await jwtDecrypt(token, key, {
      clockTolerance: "2m",
    });
    return payload as unknown as SessionData;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionData | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return await decryptSession(token);
}

export async function setSession(session: SessionData) {
  const token = await encryptSession(session);
  cookies().set(SESSION_COOKIE, token, {
    ...cookieBaseOptions(),
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSession() {
  cookies().set(SESSION_COOKIE, "", {
    ...cookieBaseOptions(),
    httpOnly: true,
    maxAge: 0,
  });
}

export function issueOAuthState(): string {
  const state = randomBytes(24).toString("base64url");
  cookies().set(OAUTH_STATE_COOKIE, state, {
    ...cookieBaseOptions(),
    httpOnly: true,
    maxAge: 60 * 10,
  });
  return state;
}

export function consumeOAuthState(expected: string): boolean {
  const got = cookies().get(OAUTH_STATE_COOKIE)?.value;
  cookies().set(OAUTH_STATE_COOKIE, "", {
    ...cookieBaseOptions(),
    httpOnly: true,
    maxAge: 0,
  });
  return !!got && got === expected;
}

export function issueCsrfToken(): string {
  const token = randomBytes(24).toString("base64url");
  cookies().set(CSRF_COOKIE, token, {
    ...cookieBaseOptions(),
    httpOnly: false,
    maxAge: 60 * 60 * 12,
  });
  return token;
}

export function readCsrfToken(): string | null {
  return cookies().get(CSRF_COOKIE)?.value ?? null;
}

export function clearCsrfToken() {
  cookies().set(CSRF_COOKIE, "", {
    ...cookieBaseOptions(),
    httpOnly: false,
    maxAge: 0,
  });
}

