import { NextResponse } from "next/server";
import { exchangeAuthorizationCode } from "@/src/lib/strava";
import {
  consumeOAuthState,
  encryptSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/src/lib/session";

export const runtime = "nodejs";

function publicOrigin(req: Request): string {
  // Behind proxies (like DigitalOcean App Platform), req.url can be the internal container hostname.
  // Use forwarded headers to build the real public origin.
  const xfProto = req.headers.get("x-forwarded-proto");
  const xfHost = req.headers.get("x-forwarded-host");
  if (xfProto && xfHost) return `${xfProto}://${xfHost}`;
  return new URL(req.url).origin;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = publicOrigin(req);
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, origin),
      { headers: { "cache-control": "no-store" } },
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const scope = url.searchParams.get("scope") ?? undefined;

  if (!code || !state) {
    // If someone visits the callback URL directly, redirect them to home
    return NextResponse.redirect(new URL("/", origin), {
      headers: { "cache-control": "no-store" },
    });
  }

  if (!(await consumeOAuthState(state))) {
    return new NextResponse("Invalid OAuth state.", { status: 400 });
  }

  const token = await exchangeAuthorizationCode(code);

  // Build session data
  const sessionData = {
    strava: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_at,
      scope,
    },
  };

  // Encrypt and set cookie directly on the redirect response
  const sessionToken = await encryptSessionToken(sessionData);
  const response = NextResponse.redirect(new URL("/activities", origin));
  response.headers.set("cache-control", "no-store");
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());

  return response;
}

