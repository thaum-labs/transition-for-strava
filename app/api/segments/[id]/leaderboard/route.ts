import { NextResponse } from "next/server";
import { getSession, setSession } from "@/src/lib/session";
import { checkRateLimit } from "@/src/lib/rateLimiter";
import { ensureFreshSession, stravaGetJsonWithRefresh } from "@/src/lib/strava";

export const runtime = "nodejs";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseSegmentId(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/\/segments\/(\d+)(?:\/|$|\?)/);
  return match ? match[1]! : null;
}

type StravaLeaderboardEntry = {
  athlete_name: string;
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  start_date_local: string;
  rank: number;
  average_hr?: number;
  average_watts?: number;
  distance?: number;
  [key: string]: unknown;
};

type StravaLeaderboardResponse = {
  effort_count: number;
  entry_count: number;
  entries: StravaLeaderboardEntry[];
  [key: string]: unknown;
};

export type LeaderboardRow = {
  rank: number;
  athlete_name: string;
  elapsed_time: number;
  start_date: string;
  average_hr: number | null;
  average_watts: number | null;
};

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rl = checkRateLimit({
    key: `segments-leaderboard:${ip}`,
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
    return new NextResponse("Invalid segment ID.", {
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
    const qs = new URLSearchParams({ following: "true" });
    const { data, session: updatedSession, refreshed: tokenRefreshed } =
      await stravaGetJsonWithRefresh<StravaLeaderboardResponse>(
        `/segments/${segmentId}/leaderboard?${qs.toString()}`,
        fresh,
        { timeoutMs: 10_000 },
      );
    if (refreshed || tokenRefreshed) await setSession(updatedSession);

    const rows: LeaderboardRow[] = (data.entries ?? []).map((e) => ({
      rank: e.rank,
      athlete_name: e.athlete_name,
      elapsed_time: e.elapsed_time,
      start_date: e.start_date ?? e.start_date_local ?? "",
      average_hr: e.average_hr ?? null,
      average_watts: e.average_watts ?? null,
    }));

    return NextResponse.json(rows, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e: unknown) {
    const status =
      isRecord(e) && typeof e.status === "number" ? (e.status as number) : 502;
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (status === 401) {
      return new NextResponse("Unauthorized.", {
        status: 401,
        headers: { "cache-control": "no-store" },
      });
    }
    if (status === 402) {
      return new NextResponse("Leaderboard requires Strava Summit.", {
        status: 402,
        headers: { "cache-control": "no-store" },
      });
    }
    if (status === 403 || status === 404) {
      return new NextResponse("Segment not found or access denied.", {
        status,
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
    return new NextResponse(`Failed to load leaderboard: ${msg}`, {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }
}
