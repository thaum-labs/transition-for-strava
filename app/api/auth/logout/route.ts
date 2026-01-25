import { NextResponse } from "next/server";
import { clearCsrfToken, clearSession } from "@/src/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  clearSession();
  clearCsrfToken();
  return NextResponse.redirect(new URL("/", req.url), {
    headers: { "cache-control": "no-store" },
  });
}

