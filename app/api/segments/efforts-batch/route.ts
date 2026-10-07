import { NextResponse } from "next/server";
import { clearSession, getSession, setSession } from "@/src/lib/session";
import { checkRateLimit } from "@/src/lib/rateLimiter";
import { ensureFreshSession, stravaGetJsonWithRefresh } from "@/src/lib/strava";
import { errorStatus, persistSessionFromError } from "@/src/lib/httpErrors";
import type { SessionData } from "@/src/lib/session";

export const runtime = "nodejs";
/** Allow free-tier activity fallback (many Strava calls) on hosted platforms. */
export const maxDuration = 60;

const MAX_SEGMENTS = 25;
const STRAVA_TIMEOUT_MS = 8_000;
const SUMMIT_REQUIRED_MSG =
  "Segment efforts require a Strava Summit subscription.";
const FREE_TIER_ACTIVITIES_LIMIT = 15;
const STRAVA_CONCURRENCY = 5;

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
  is_fastest?: boolean;
};

function effortToRow(e: StravaSegmentEffort): SegmentEffortRow {
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
}

/** 10 most recent efforts + the single fastest (if not already in those 10). Fastest row gets is_fastest. */
function transformEfforts(efforts: StravaSegmentEffort[]): SegmentEffortRow[] {
  if (efforts.length === 0) return [];
  const rows = efforts.map(effortToRow);
  const byDateDesc = [...rows].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
  );
  const recent10 = byDateDesc.slice(0, 10);
  const fastest = rows.reduce((best, r) =>
    r.elapsed_time < best.elapsed_time ? r : best,
  );
  const key = (r: SegmentEffortRow) => `${r.start_date}-${r.elapsed_time}`;
  const recentSet = new Set(recent10.map(key));
  const combined =
    recentSet.has(key(fastest))
      ? recent10
      : [...recent10, fastest].sort(
          (a, b) =>
            new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
        );
  const minTime = Math.min(...combined.map((r) => r.elapsed_time));
  return combined.map((r) => ({
    ...r,
    is_fastest: r.elapsed_time === minTime,
  }));
}

type SegmentResult =
  | { efforts: SegmentEffortRow[]; refreshed: boolean }
  | { error: string; refreshed: boolean };

function getStatus(e: unknown): number | undefined {
  const status = (e as { status?: number })?.status;
  return typeof status === "number" ? status : undefined;
}

const SEGMENT_EFFORTS_PAGE_SIZE = 30;

/** Efforts within the last 12 months only. */
const EFFORTS_CUTOFF_MS = 365 * 24 * 60 * 60 * 1000;

function filterLast12Months(efforts: StravaSegmentEffort[]): StravaSegmentEffort[] {
  const cutoff = Date.now() - EFFORTS_CUTOFF_MS;
  return efforts.filter((e) => new Date(e.start_date).getTime() >= cutoff);
}

function isSummitBlockedError(error: string): boolean {
  return error === SUMMIT_REQUIRED_MSG || error === "Not available.";
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) break;
      results[index] = await fn(items[index]!);
    }
  }
  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

type SessionTracker = {
  session: SessionData;
  dirty: boolean;
  noteRefresh: (session: SessionData, refreshed: boolean) => void;
};

function createSessionTracker(initial: SessionData, initiallyDirty: boolean): SessionTracker {
  const state = { session: initial, dirty: initiallyDirty };
  return {
    get session() {
      return state.session;
    },
    get dirty() {
      return state.dirty;
    },
    noteRefresh(session: SessionData, refreshed: boolean) {
      if (refreshed) {
        state.session = session;
        state.dirty = true;
      }
    },
  };
}

async function fetchEffortsForSegment(
  segmentId: string,
  tracker: SessionTracker,
): Promise<SegmentResult> {
  const perPages = [SEGMENT_EFFORTS_PAGE_SIZE, 1] as const;
  for (const perPage of perPages) {
    try {
      const qs = new URLSearchParams({
        segment_id: segmentId,
        per_page: String(perPage),
      });
      const { data: efforts, session: updatedSession, refreshed } =
        await stravaGetJsonWithRefresh<StravaSegmentEffort[]>(
          `/segment_efforts?${qs.toString()}`,
          tracker.session,
          { timeoutMs: STRAVA_TIMEOUT_MS },
        );
      tracker.noteRefresh(updatedSession, refreshed);
      const recent = filterLast12Months(efforts);
      return {
        efforts: transformEfforts(recent),
        refreshed,
      };
    } catch (e: unknown) {
      const status = getStatus(e);
      if (status === 402) {
        if (perPage === 1) {
          return { error: SUMMIT_REQUIRED_MSG, refreshed: false };
        }
        continue;
      }
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (status === 504) return { error: "Timed out. Try again.", refreshed: false };
      if (status === 429) return { error: "Rate limit.", refreshed: false };
      if (status === 401 || status === 403 || status === 404)
        return { error: "Not available.", refreshed: false };
      return { error: msg, refreshed: false };
    }
  }
  return { error: SUMMIT_REQUIRED_MSG, refreshed: false };
}

type ActivitySegmentEffort = {
  elapsed_time: number;
  moving_time: number;
  distance: number;
  start_date: string;
  average_watts?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  segment?: { id: number; elevation_high?: number; elevation_low?: number };
  [key: string]: unknown;
};

type DetailedActivity = {
  id: number;
  segment_efforts?: ActivitySegmentEffort[];
  [key: string]: unknown;
};

async function fetchEffortsFromActivities(
  tracker: SessionTracker,
  segmentIdSet: Set<string>,
): Promise<Map<string, SegmentEffortRow[]>> {
  const out = new Map<string, StravaSegmentEffort[]>();
  try {
    const { data: activities, session: s1, refreshed } =
      await stravaGetJsonWithRefresh<{ id: number }[]>(
        `/athlete/activities?per_page=${FREE_TIER_ACTIVITIES_LIMIT}&page=1`,
        tracker.session,
        { timeoutMs: STRAVA_TIMEOUT_MS },
      );
    tracker.noteRefresh(s1, refreshed);
    if (!Array.isArray(activities) || activities.length === 0) return new Map();

    const ids = activities.slice(0, FREE_TIER_ACTIVITIES_LIMIT).map((a) => a.id);
    const details = await mapPool(ids, STRAVA_CONCURRENCY, async (id) => {
      const { data, session: updatedSession, refreshed: tokenRefreshed } =
        await stravaGetJsonWithRefresh<DetailedActivity>(
          `/activities/${id}?include_all_efforts=true`,
          tracker.session,
          { timeoutMs: STRAVA_TIMEOUT_MS },
        );
      tracker.noteRefresh(updatedSession, tokenRefreshed);
      return data;
    });

    const cutoffMs = Date.now() - EFFORTS_CUTOFF_MS;
    for (const activity of details) {
      const efforts = activity?.segment_efforts;
      if (!Array.isArray(efforts)) continue;
      for (const e of efforts) {
        const segId = e.segment?.id != null ? String(e.segment.id) : null;
        if (!segId || !segmentIdSet.has(segId)) continue;
        if (new Date(e.start_date).getTime() < cutoffMs) continue;
        const list = out.get(segId) ?? [];
        list.push(e as StravaSegmentEffort);
        out.set(segId, list);
      }
    }
  } catch {
    // Return whatever we collected.
  }

  const rowsBySegment = new Map<string, SegmentEffortRow[]>();
  for (const [segId, raw] of out) {
    rowsBySegment.set(segId, transformEfforts(raw));
  }
  return rowsBySegment;
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

  const segmentIdsRaw: string[] =
    body != null &&
    typeof body === "object" &&
    Array.isArray((body as { segmentIds?: unknown }).segmentIds) &&
    (body as { segmentIds: unknown[] }).segmentIds.every((x) => typeof x === "string")
      ? (body as { segmentIds: string[] }).segmentIds
          .map((s) => String(s).trim())
          .filter((s) => /^\d+$/.test(s))
      : [];
  const segmentIds = [...new Set(segmentIdsRaw)];
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

  try {
    const { session: fresh, refreshed } = await ensureFreshSession(session);
    const tracker = createSessionTracker(fresh, refreshed);
    const segmentIdSet = new Set(segmentIds);

    const probe = await fetchEffortsForSegment(segmentIds[0]!, tracker);
    const useSummitApi =
      !("error" in probe) || !isSummitBlockedError(probe.error);

    const byId: EffortsBatchResult = {};

    if (useSummitApi) {
      if ("efforts" in probe) {
        byId[segmentIds[0]!] = { efforts: probe.efforts };
      } else {
        byId[segmentIds[0]!] = { error: probe.error };
      }

      const rest = segmentIds.slice(1);
      const restResults = await mapPool(rest, STRAVA_CONCURRENCY, async (id) => {
        const out = await fetchEffortsForSegment(id, tracker);
        return { id, out };
      });

      for (const { id, out } of restResults) {
        if ("efforts" in out) {
          byId[id] = { efforts: out.efforts };
        } else {
          byId[id] = { error: out.error };
        }
      }
    } else {
      for (const id of segmentIds) {
        byId[id] = {
          error:
            "error" in probe ? probe.error : SUMMIT_REQUIRED_MSG,
        };
      }
    }

    const needsActivityFallback = segmentIds.some((id) => {
      const entry = byId[id];
      if (!entry) return true;
      if ("efforts" in entry && entry.efforts.length > 0) return false;
      if ("error" in entry && isSummitBlockedError(entry.error)) return true;
      return "efforts" in entry && entry.efforts.length === 0;
    });

    if (needsActivityFallback) {
      const fromActivities = await fetchEffortsFromActivities(tracker, segmentIdSet);
      for (const segmentId of segmentIds) {
        const fromApi = byId[segmentId];
        if (fromApi && "efforts" in fromApi && fromApi.efforts.length > 0) continue;
        const fromActs = fromActivities.get(segmentId);
        if (fromActs && fromActs.length > 0) {
          byId[segmentId] = { efforts: fromActs };
        } else if (!fromApi || ("error" in fromApi && isSummitBlockedError(fromApi.error))) {
          byId[segmentId] = {
            error: "No attempts in your recent activities.",
          };
        }
      }
    }

    if (tracker.dirty) await setSession(tracker.session);

    return NextResponse.json(byId, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e: unknown) {
    await persistSessionFromError(e);
    const status = errorStatus(e) ?? 502;
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
    return new NextResponse("Failed to load segment efforts.", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }
}
