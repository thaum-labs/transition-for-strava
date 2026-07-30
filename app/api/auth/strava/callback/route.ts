import { NextResponse } from "next/server";
import { exchangeAuthorizationCode } from "@/src/lib/strava";
import {
  consumeOAuthState,
  encryptSessionToken,
  SESSION_COOKIE_NAME,
} from "@/src/lib/session";
import { getAppBaseUrl, isProd } from "@/src/lib/env";

export const runtime = "nodejs";

function buildSetCookieHeader(name: string, value: string): string {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    `SameSite=Lax`,
    `Max-Age=2592000`, // 30 days
  ];
  if (isProd()) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = getAppBaseUrl(req);
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

  // Encrypt session token
  const sessionToken = await encryptSessionToken(sessionData);
  const redirectUrl = new URL("/activities", origin).toString();

  // Return an HTML page that sets the cookie (via Set-Cookie header) and redirects via JS.
  // This works around Cloudflare/proxies stripping Set-Cookie from 302 redirects.
  // Serialize the URL with JSON.stringify so it cannot break out of the script string.
  const redirectJson = JSON.stringify(redirectUrl);
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecting...</title>
  <script>window.location.replace(${redirectJson});</script>
</head>
<body>
  <p>Redirecting to your activities...</p>
  <p><a href=${redirectJson}>Click here if not redirected automatically.</a></p>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "set-cookie": buildSetCookieHeader(SESSION_COOKIE_NAME, sessionToken),
    },
  });
}
