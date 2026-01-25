import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/src/lib/session";
import { isProd, optionalEnv } from "@/src/lib/env";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const store = await cookies();
  const allCookieNames = store.getAll().map((c) => c.name);
  const token = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  const session = await getSession();

  const cookieOpts = sessionCookieOptions();
  const appBaseUrl = optionalEnv("APP_BASE_URL") ?? "(not set)";

  // Check request headers for debugging
  const xfHost = req.headers.get("x-forwarded-host") ?? "(none)";
  const xfProto = req.headers.get("x-forwarded-proto") ?? "(none)";
  const host = req.headers.get("host") ?? "(none)";

  return NextResponse.json(
    {
      hasCookie: token.length > 0,
      cookieLength: token.length,
      hasSession: !!session,
      isProd: isProd(),
      hasSessionSecret: !!process.env.SESSION_SECRET,
      allCookieNames,
      cookieOpts,
      appBaseUrl,
      headers: { xfHost, xfProto, host },
    },
    { headers: { "cache-control": "no-store" } },
  );
}

