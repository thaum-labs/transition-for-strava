import { NextResponse } from "next/server";
import { clearCsrfToken, clearSession } from "@/src/lib/session";

export const runtime = "nodejs";

function publicOrigin(req: Request): string {
  const xfProto = req.headers.get("x-forwarded-proto");
  const xfHost = req.headers.get("x-forwarded-host");
  if (xfProto && xfHost) return `${xfProto}://${xfHost}`;
  return new URL(req.url).origin;
}

export async function GET(req: Request) {
  await clearSession();
  await clearCsrfToken();
  return NextResponse.redirect(new URL("/", publicOrigin(req)), {
    headers: { "cache-control": "no-store" },
  });
}

