import { NextResponse } from "next/server";
import { clearSession, getSession, setSession } from "@/src/lib/session";
import { checkRateLimit } from "@/src/lib/rateLimiter";
import { ensureFreshSession, stravaGetJsonWithRefresh } from "@/src/lib/strava";
import { errorStatus, persistSessionFromError } from "@/src/lib/httpErrors";

export const runtime = "nodejs";

type StravaSegment = {
  id: number;
  name: string;
  distance: number;
  total_elevation_gain?: number;
  average_grade?: number;
  elevation_high?: number;
  elevation_low?: number;
  [key: string]: unknown;
};

function parseSegmentId(raw: string): string | null {
  const trimmed = raw.trim();
  const digitsOnly = /^\d+$/.test(trimmed);
  if (digitsOnly) return trimmed;
  const match = trimmed.match(/\/segments\/(\d+)(?:\/|$|\?)/);
  return match ? match[1]! : null;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rl = checkRateLimit({
    key: `segments:${ip}`,
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

  try {
    const { session: fresh, refreshed } = await ensureFreshSession(session);
    const { data, session: updatedSession, refreshed: tokenRefreshed } =
      await stravaGetJsonWithRefresh<StravaSegment>(
        `/segments/${segmentId}`,
        fresh,
      );
    if (refreshed || tokenRefreshed) await setSession(updatedSession);

    const elevGain =
      data.total_elevation_gain ??
      (data.elevation_high != null && data.elevation_low != null
        ? data.elevation_high - data.elevation_low
        : undefined);

    return NextResponse.json(
      {
        name: data.name,
        distance: data.distance,
        total_elevation_gain: elevGain,
        average_grade: data.average_grade,
      },
      { headers: { "cache-control": "no-store" } },
    );
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
    return new NextResponse("Failed to load segment.", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }
}
