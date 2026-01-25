import { NextResponse } from "next/server";
import { issueCsrfToken } from "@/src/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const token = issueCsrfToken();
  return NextResponse.json(
    { token },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

