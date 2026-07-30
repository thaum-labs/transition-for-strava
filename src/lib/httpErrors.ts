import { NextResponse } from "next/server";
import { clearSession } from "@/src/lib/session";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function errorStatus(err: unknown): number | null {
  if (!isRecord(err)) return null;
  const status = err.status;
  return typeof status === "number" ? status : null;
}

/** Persist a refreshed session attached to an error (token rotated before retry failed). */
export async function persistSessionFromError(err: unknown): Promise<void> {
  if (!isRecord(err)) return;
  const session = err.updatedSession;
  if (session && typeof session === "object" && "strava" in session) {
    const { setSession } = await import("@/src/lib/session");
    await setSession(session as Parameters<typeof setSession>[0]);
  }
}

export async function stravaErrorResponse(
  err: unknown,
  fallbackMessage: string,
): Promise<NextResponse> {
  await persistSessionFromError(err);
  const status = errorStatus(err) ?? 502;

  if (status === 401) {
    await clearSession();
    return new NextResponse("Unauthorized.", {
      status: 401,
      headers: { "cache-control": "no-store" },
    });
  }
  if (status === 429) {
    return new NextResponse("Strava rate limit reached. Try again later.", {
      status: 429,
      headers: { "cache-control": "no-store" },
    });
  }
  if (status === 504) {
    return new NextResponse("Strava timed out. Try again in a moment.", {
      status: 504,
      headers: { "cache-control": "no-store" },
    });
  }
  return new NextResponse(fallbackMessage, {
    status: 502,
    headers: { "cache-control": "no-store" },
  });
}
