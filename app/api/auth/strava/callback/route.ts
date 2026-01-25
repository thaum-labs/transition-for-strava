import { NextResponse } from "next/server";
import { exchangeAuthorizationCode } from "@/src/lib/strava";
import { consumeOAuthState, setSession } from "@/src/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, url.origin),
      { headers: { "cache-control": "no-store" } },
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const scope = url.searchParams.get("scope") ?? undefined;

  if (!code || !state) {
    // If someone visits the callback URL directly, redirect them to home
    return NextResponse.redirect(new URL("/", url.origin), {
      headers: { "cache-control": "no-store" },
    });
  }

  if (!consumeOAuthState(state)) {
    return new NextResponse("Invalid OAuth state.", { status: 400 });
  }

  const token = await exchangeAuthorizationCode(code);

  await setSession({
    strava: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_at,
      scope,
    },
  });

  return NextResponse.redirect(new URL("/activities", url.origin), {
    headers: { "cache-control": "no-store" },
  });
}

