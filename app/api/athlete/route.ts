import { NextResponse } from "next/server";
import { getSession, setSession } from "@/src/lib/session";
import { checkRateLimit } from "@/src/lib/rateLimiter";
import { ensureFreshSession, stravaGetJsonWithRefresh } from "@/src/lib/strava";

export const runtime = "nodejs";

type StravaAthlete = {
  id: number;
  [key: string]: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

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

  const { session: fresh, refreshed } = await ensureFreshSession(session);

  try {
    const { data, session: updatedSession, refreshed: tokenRefreshed } =
      await stravaGetJsonWithRefresh<StravaAthlete>("/athlete", fresh);
    if (refreshed || tokenRefreshed) await setSession(updatedSession);

    return NextResponse.json({ id: data.id }, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e: unknown) {
    const status =
      isRecord(e) && typeof e.status === "number" ? (e.status as number) : 502;
    if (status === 401) {
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
    return new NextResponse("Failed to load athlete.", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }
}
