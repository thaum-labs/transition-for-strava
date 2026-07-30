import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requiredEnv, isProd } from "@/src/lib/env";

export const runtime = "nodejs";

const OAUTH_STATE_COOKIE = "pp_oauth_state";

function buildOAuthStateCookie(state: string): string {
  const parts = [
    `${OAUTH_STATE_COOKIE}=${state}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=600", // 10 minutes
  ];
  if (isProd()) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export async function GET() {
  const state = randomBytes(24).toString("base64url");

  const clientId = requiredEnv("STRAVA_CLIENT_ID");
  const redirectUri = requiredEnv("STRAVA_REDIRECT_URI");
  const scopes = (process.env.STRAVA_SCOPES ?? "activity:read_all").trim();

  const authorizeUrl = new URL("https://www.strava.com/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("approval_prompt", "auto");
  authorizeUrl.searchParams.set("scope", scopes);
  authorizeUrl.searchParams.set("state", state);

  // Return HTML 200 with Set-Cookie, then JS-redirect to Strava.
  // Same workaround as the OAuth callback: some proxies (Cloudflare/DO)
  // strip Set-Cookie from 302 responses, which left pp_oauth_state unset
  // and caused "Invalid OAuth state" on callback.
  const authorizeJson = JSON.stringify(authorizeUrl.toString());
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Continuing to Strava…</title>
  <script>window.location.replace(${authorizeJson});</script>
</head>
<body>
  <p>Continuing to Strava…</p>
  <p><a href=${authorizeJson}>Click here if you are not redirected.</a></p>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "set-cookie": buildOAuthStateCookie(state),
    },
  });
}
