import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";
import { requiredEnv } from "@/src/lib/env";

const STATE_TYP = "oauth-state";
const STATE_MAX_AGE = "10m";

function deriveKey(): Uint8Array {
  const secret = requiredEnv("SESSION_SECRET");
  return createHash("sha256").update(secret).digest();
}

/**
 * Create a signed, short-lived OAuth `state` value.
 * Validation is cryptographic — no cookie round-trip required — which avoids
 * proxy Set-Cookie stripping and cross-host cookie loss during the Strava hop.
 */
export async function createOAuthState(): Promise<string> {
  const key = deriveKey();
  const nonce = randomBytes(16).toString("base64url");
  return await new SignJWT({ typ: STATE_TYP, nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(STATE_MAX_AGE)
    .sign(key);
}

/**
 * Verify a signed OAuth state from the callback query string.
 * Returns true only for a valid, unexpired token we issued.
 */
export async function verifyOAuthState(state: string): Promise<boolean> {
  if (!state || state.length > 2048) return false;
  const key = deriveKey();
  try {
    const { payload } = await jwtVerify(state, key, {
      algorithms: ["HS256"],
      clockTolerance: "30s",
      maxTokenAge: "10m",
    });
    return payload.typ === STATE_TYP && typeof payload.nonce === "string";
  } catch {
    return false;
  }
}
