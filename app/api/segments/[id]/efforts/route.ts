import { NextResponse } from "next/server";
import { getSession, setSession } from "@/src/lib/session";
import { checkRateLimit } from "@/src/lib/rateLimiter";
import { ensureFreshSession, stravaGetJsonWithRefresh } from "@/src/lib/strava";

export const runtime = "nodejs";

type StravaAthlete = { id: number; [key: string]: unknown };

type StravaSegmentSummary = {
  elevation_high?: number;
  elevation_low?: number;
  average_grade?: number;
  [key: string]: unknown;
};

type StravaSegmentEffort = {
  id: number;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  start_date: string;
  average_watts?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  segment?: StravaSegmentSummary;
  [key: string]: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseSegmentId(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/\/segments\/(\d+)(?:\/|$|\?)/);
  return match ? match[1]! : null;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rl = checkRateLimit({
    key: `segments-efforts:${ip}`,
    limit: 60,
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

  const { id: rawId } = await context.params;
  const segmentId = parseSegmentId(rawId);
  if (!segmentId) {
    return new NextResponse("Invalid segment ID or URL.", {
      status: 400,
      headers: { "cache-control": "no-store" },
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
    const { session: sessionAfterAthlete, refreshed: athleteRefreshed } =
      await ensureFreshSession(fresh);
    const athleteSession = sessionAfterAthlete;

    const { data: athlete, session: sessionWithAthlete, refreshed: tokenRefreshed1 } =
      await stravaGetJsonWithRefresh<StravaAthlete>("/athlete", athleteSession);
    let currentSession = sessionWithAthlete;
    if (refreshed || athleteRefreshed || tokenRefreshed1) await setSession(currentSession);

    const athleteId = athlete.id;

    const qs = new URLSearchParams({
      athlete_id: String(athleteId),
      per_page: "200",
    });
    const { data: efforts, session: sessionAfterEfforts, refreshed: tokenRefreshed2 } =
      await stravaGetJsonWithRefresh<StravaSegmentEffort[]>(
        `/segments/${segmentId}/all_efforts?${qs.toString()}`,
        currentSession,
      );
    currentSession = sessionAfterEfforts;
    if (tokenRefreshed2) await setSession(currentSession);

    const byTime = [...efforts].sort((a, b) => a.elapsed_time - b.elapsed_time);
    const best5 = byTime.slice(0, 5);
    const byDateDesc = [...best5].sort(
      (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
    );

    const out = byDateDesc.map((e) => {
      const movingTimeHours = e.moving_time / 3600;
      const speedKmh = movingTimeHours > 0 ? e.distance / 1000 / movingTimeHours : null;
      const seg = e.segment;
      const elevHigh = seg?.elevation_high;
      const elevLow = seg?.elevation_low;
      const elevGain =
        elevHigh != null && elevLow != null ? elevHigh - elevLow : null;
      const elapsedHours = e.elapsed_time / 3600;
      const vam = elevGain != null && elapsedHours > 0 ? elevGain / elapsedHours : null;

      return {
        elapsed_time: e.elapsed_time,
        moving_time: e.moving_time,
        distance: e.distance,
        start_date: e.start_date,
        average_watts: e.average_watts ?? null,
        average_heartrate: e.average_heartrate ?? null,
        max_heartrate: e.max_heartrate ?? null,
        speed_kmh: speedKmh != null ? Math.round(speedKmh * 10) / 10 : null,
        vam_mh: vam != null ? Math.round(vam) : null,
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
    if (status === 403 || status === 404) {
      return new NextResponse("Segment not found or access denied.", {
        status: status,
        headers: { "cache-control": "no-store" },
      });
    }
    if (status === 429) {
      return new NextResponse("Strava rate limit reached. Try again later.", {
        status: 429,
        headers: { "cache-control": "no-store" },
      });
    }
    return new NextResponse("Failed to load segment efforts.", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }
}
