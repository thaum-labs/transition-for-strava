import { NextResponse } from "next/server";
import { isProd } from "@/src/lib/env";

export const runtime = "nodejs";

function buildSetCookieHeader(name: string, value: string): string {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    `SameSite=Lax`,
    `Max-Age=300`, // 5 minutes
  ];
  if (isProd()) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export async function GET() {
  const testValue = `test_${Date.now()}`;
  const response = NextResponse.json({
    message: "Setting test cookie",
    cookieName: "debug_test",
    cookieValue: testValue,
    isProd: isProd(),
  });
  response.headers.set("set-cookie", buildSetCookieHeader("debug_test", testValue));
  response.headers.set("cache-control", "no-store");
  return response;
}
