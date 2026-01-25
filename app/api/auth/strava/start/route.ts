import { NextResponse } from "next/server";
import { requiredEnv } from "@/src/lib/env";
import { issueOAuthState } from "@/src/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const state = await issueOAuthState();

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

  return NextResponse.redirect(authorizeUrl.toString(), {
    headers: { "cache-control": "no-store" },
  });
}

