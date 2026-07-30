import { NextResponse } from "next/server";
import { exchangeAuthorizationCode } from "@/src/lib/strava";
import {
  encryptSessionToken,
  SESSION_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
  sessionCookieOptions,
} from "@/src/lib/session";
import { verifyOAuthState } from "@/src/lib/oauthState";
import { isProd } from "@/src/lib/env";

export const runtime = "nodejs";

/** Origin of the host that handled this request (where cookies are scoped). */
function requestOrigin(req: Request): string {
  const xfProto = req.headers.get("x-forwarded-proto");
  const xfHost =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (xfProto && xfHost) {
    const host = xfHost.split(",")[0].trim().toLowerCase();
    const proto = xfProto.split(",")[0].trim().toLowerCase();
    if (
      (proto === "http" || proto === "https") &&
      /^[a-z0-9.-]+(?::\d+)?$/i.test(host)
    ) {
      return `${proto}://${host}`;
    }
  }
  return new URL(req.url).origin;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  // Use the request host for server redirects so we never bounce the browser
  // onto a different host than the one that set the session cookie.
  const origin = requestOrigin(req);
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
    return NextResponse.redirect(new URL("/", origin), {
      headers: { "cache-control": "no-store" },
    });
  }

  if (!(await verifyOAuthState(state))) {
    return new NextResponse("Invalid OAuth state.", { status: 400 });
  }

  const token = await exchangeAuthorizationCode(code);

  const sessionData = {
    strava: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_at,
      scope,
    },
  };

  const sessionToken = await encryptSessionToken(sessionData);

  // Relative redirect keeps the browser on the same host that received Set-Cookie.
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecting...</title>
  <script>window.location.replace("/activities");</script>
</head>
<body>
  <p>Redirecting to your activities...</p>
  <p><a href="/activities">Click here if not redirected automatically.</a></p>
</body>
</html>`;

  const res = new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });

  res.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
  // Clear any legacy oauth-state cookie from older deployments.
  res.cookies.set(OAUTH_STATE_COOKIE_NAME, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProd(),
    maxAge: 0,
  });

  return res;
}
