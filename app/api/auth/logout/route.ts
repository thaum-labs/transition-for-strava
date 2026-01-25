import { NextResponse } from "next/server";
import { clearCsrfToken, clearSession } from "@/src/lib/session";

export const runtime = "nodejs";

// GET requests should NOT perform logout (prefetching would log users out)
export async function GET() {
  return new NextResponse("Use POST to log out.", { status: 405 });
}

// POST request to actually perform logout
export async function POST() {
  await clearSession();
  await clearCsrfToken();
  // Return JSON instead of redirect so client can handle navigation
  return NextResponse.json(
    { success: true, redirectTo: "/" },
    { headers: { "cache-control": "no-store" } }
  );
}

