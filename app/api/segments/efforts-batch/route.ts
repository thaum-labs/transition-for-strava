import { NextResponse } from "next/server";
import { getSession, setSession } from "@/src/lib/session";
import { checkRateLimit } from "@/src/lib/rateLimiter";
import { ensureFreshSession, stravaGetJsonWithRefresh } from "@/src/lib/strava";
import type { SessionData } from "@/src/lib/session";

export const runtime = "nodejs";

const MAX_SEGMENTS = 25;
const STRAVA_TIMEOUT_MS = 8_000;
const SUMMIT_REQUIRED_MSG =
  "Segment efforts require a Strava Summit subscription.";

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

export type SegmentEffortRow = {
  elapsed_time: number;
  moving_time: number;
  distance: number;
  start_date: string;
  average_watts: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  speed_kmh: number | null;
  vam_mh: number | null;
};

function transformEfforts(efforts: StravaSegmentEffort[]): SegmentEffortRow[] {
  const byTime = [...efforts].sort((a, b) => a.elapsed_time - b.elapsed_time);
  const best5 = byTime.slice(0, 5);
  const byDateDesc = [...best5].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
  );
  return byDateDesc.map((e) => {
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
}

type SegmentResult =
  | { efforts: SegmentEffortRow[]; session: SessionData; refreshed: boolean }
  | { error: string };

function getStatus(e: unknown): number | undefined {
  const status = (e as { status?: number })?.status;
  return typeof status === "number" ? status : undefined;
}

async function fetchEffortsForSegment(
  segmentId: string,
  session: SessionData,
): Promise<SegmentResult> {
  const perPages = [5, 1] as const;
  for (const perPage of perPages) {
    try {
      const qs = new URLSearchParams({
        segment_id: segmentId,
        per_page: String(perPage),
      });
      const { data: efforts, session: updatedSession, refreshed } =
        await stravaGetJsonWithRefresh<StravaSegmentEffort[]>(
          `/segment_efforts?${qs.toString()}`,
          session,
          { timeoutMs: STRAVA_TIMEOUT_MS },
        );
      return {
        efforts: transformEfforts(efforts),
        session: updatedSession,
        refreshed,
      };
    } catch (e: unknown) {
      const status = getStatus(e);
      if (status === 402) {
        if (perPage === 1) {
          return { error: SUMMIT_REQUIRED_MSG };
        }
        continue;
      }
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (status === 504) return { error: "Timed out. Try again." };
      if (status === 429) return { error: "Rate limit." };
      if (status === 401 || status === 403 || status === 404)
        return { error: "Not available." };
      return { error: msg };
    }
  }
  return { error: SUMMIT_REQUIRED_MSG };
}

export type EffortsBatchResult = Record<
  string,
  { efforts: SegmentEffortRow[] } | { error: string }
>;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rl = checkRateLimit({
    key: `segments-efforts-batch:${ip}`,
    limit: 20,
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON body.", {
      status: 400,
      headers: { "cache-control": "no-store" },
    });
  }

  const segmentIds: string[] =
    Array.isArray((body as { segmentIds?: unknown }).segmentIds) &&
    (body as { segmentIds: unknown[] }).segmentIds.every((x) => typeof x === "string")
      ? (body as { segmentIds: string[] }).segmentIds
          .map((s) => String(s).trim())
          .filter((s) => /^\d+$/.test(s))
      : [];
  if (segmentIds.length === 0) {
    return new NextResponse("Missing or invalid segmentIds.", {
      status: 400,
      headers: { "cache-control": "no-store" },
    });
  }
  if (segmentIds.length > MAX_SEGMENTS) {
    return new NextResponse(`At most ${MAX_SEGMENTS} segments allowed.`, {
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
  if (refreshed) await setSession(fresh);

  const results = await Promise.all(
    segmentIds.map(async (id) => {
      const out = await fetchEffortsForSegment(id, fresh);
      if ("efforts" in out) {
        if (out.refreshed) await setSession(out.session);
        return { id, efforts: out.efforts } as const;
      }
      return { id, error: out.error } as const;
    }),
  );

  const byId: EffortsBatchResult = {};
  for (const r of results) {
    if ("efforts" in r && r.efforts !== undefined) {
      byId[r.id] = { efforts: r.efforts };
    } else {
      byId[r.id] = { error: "error" in r ? r.error : "Unknown error" };
    }
  }

  return NextResponse.json(byId, {
    headers: { "cache-control": "no-store" },
  });
}
