import { NextResponse } from "next/server";
import { getSession, setSession } from "@/src/lib/session";
import { checkRateLimit } from "@/src/lib/rateLimiter";
import { ensureFreshSession, stravaGetJsonWithRefresh } from "@/src/lib/strava";

export const runtime = "nodejs";

type StravaSegmentSummary = {
  id: number;
  name: string;
  distance: number;
  average_grade?: number;
  elevation_high?: number;
  elevation_low?: number;
  total_elevation_gain?: number;
  [key: string]: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rl = checkRateLimit({
    key: `segments-starred:${ip}`,
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
    const allSegments: StravaSegmentSummary[] = [];
    let page = 1;
    const perPage = 200;
    let currentSession = fresh;

    while (true) {
      const qs = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      const { data, session: updatedSession, refreshed: tokenRefreshed } =
        await stravaGetJsonWithRefresh<StravaSegmentSummary[]>(
          `/segments/starred?${qs.toString()}`,
          currentSession,
        );
      currentSession = updatedSession;
      if (refreshed || tokenRefreshed) await setSession(updatedSession);

      if (!Array.isArray(data) || data.length === 0) break;
      allSegments.push(...data);
      if (data.length < perPage) break;
      page += 1;
    }

    const out = allSegments.map((s) => {
      const elevGain =
        s.total_elevation_gain ??
        (s.elevation_high != null && s.elevation_low != null
          ? s.elevation_high - s.elevation_low
          : undefined);
      return {
        id: String(s.id),
        name: s.name,
        distance: s.distance,
        total_elevation_gain: elevGain,
        average_grade: s.average_grade,
      };
    });

    return NextResponse.json(out, {
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
    return new NextResponse("Failed to load starred segments.", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }
}
