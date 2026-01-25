import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession, SESSION_COOKIE_NAME } from "@/src/lib/session";
import { isProd } from "@/src/lib/env";

export const runtime = "nodejs";

export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  const session = await getSession();

  return NextResponse.json(
    {
      hasCookie: token.length > 0,
      cookieLength: token.length,
      hasSession: !!session,
      isProd: isProd(),
      hasSessionSecret: !!process.env.SESSION_SECRET,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

