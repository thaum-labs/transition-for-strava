import { NextResponse } from "next/server";
import { clearCsrfToken, clearSession } from "@/src/lib/session";

export const runtime = "nodejs";

function publicOrigin(req: Request): string {
  const xfProto = req.headers.get("x-forwarded-proto");
  const xfHost = req.headers.get("x-forwarded-host");
  if (xfProto && xfHost) return `${xfProto}://${xfHost}`;
  return new URL(req.url).origin;
}

// GET requests should NOT perform logout (prefetching would log users out)
export async function GET() {
  return new NextResponse("Use POST to log out.", { status: 405 });
}

// POST request to actually perform logout
export async function POST(req: Request) {
  await clearSession();
  await clearCsrfToken();
  // Return JSON instead of redirect so client can handle navigation
  return NextResponse.json(
    { success: true, redirectTo: "/" },
    { headers: { "cache-control": "no-store" } }
  );
}

