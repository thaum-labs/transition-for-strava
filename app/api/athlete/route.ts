import { NextResponse } from "next/server";
import { clearSession, getSession, setSession } from "@/src/lib/session";
import { checkRateLimit } from "@/src/lib/rateLimiter";
import { ensureFreshSession, stravaGetJsonWithRefresh } from "@/src/lib/strava";
import { errorStatus, persistSessionFromError, stravaErrorResponse } from "@/src/lib/httpErrors";

export const runtime = "nodejs";

type StravaAthlete = {
  id: number;
  [key: string]: unknown;
};

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rl = checkRateLimit({
    key: `athlete:${ip}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return new NextResponse("Too many requests. Please try again.", {
      status: 429,
      headers: {
        "retry-after": String(rl.retryAfterSeconds ?? 60),
        "cache-control": "no-store",
      },
    });
  }

  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized.", {
      status: 401,
      headers: { "cache-control": "no-store" },
    });
  }

  try {
    const { session: fresh, refreshed } = await ensureFreshSession(session);
    const { data, session: updatedSession, refreshed: tokenRefreshed } =
      await stravaGetJsonWithRefresh<StravaAthlete>("/athlete", fresh);
    if (refreshed || tokenRefreshed) await setSession(updatedSession);

    return NextResponse.json(
      { id: String(data.id) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e: unknown) {
    await persistSessionFromError(e);
    if (errorStatus(e) === 401) await clearSession();
    return stravaErrorResponse(e, "Failed to load athlete.");
  }
}
