import { NextResponse } from "next/server";
import { z } from "zod";
import { clearSession, getSession, setSession } from "@/src/lib/session";
import { checkRateLimit } from "@/src/lib/rateLimiter";
import { ensureFreshSession, stravaGetJsonWithRefresh } from "@/src/lib/strava";
import { errorStatus, persistSessionFromError } from "@/src/lib/httpErrors";

export const runtime = "nodejs";

const QuerySchema = z.object({
  per_page: z.coerce.number().int().min(1).max(200).default(30),
  page: z.coerce.number().int().min(1).max(50).default(1),
  before: z.coerce.number().int().positive().optional(),
  after: z.coerce.number().int().positive().optional(),
});

type StravaSummaryActivity = {
  id: number | string;
  name: string;
  sport_type: string;
  start_date: string;
  distance: number;
  moving_time: number;
  total_elevation_gain?: number;
  average_speed?: number;
  max_speed?: number;
};

export async function GET(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const rl = checkRateLimit({
    key: `activities:${ip}`,
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

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return new NextResponse("Invalid query.", {
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

  const qs = new URLSearchParams({
    per_page: String(parsed.data.per_page),
    page: String(parsed.data.page),
  });
  if (parsed.data.before) qs.set("before", String(parsed.data.before));
  if (parsed.data.after) qs.set("after", String(parsed.data.after));

  try {
    const { session: fresh, refreshed } = await ensureFreshSession(session);
    const { data, session: updatedSession, refreshed: tokenRefreshed } =
      await stravaGetJsonWithRefresh<StravaSummaryActivity[]>(
        `/athlete/activities?${qs.toString()}`,
        fresh,
      );
    if (refreshed || tokenRefreshed) await setSession(updatedSession);

    // Preserve IDs as strings to avoid JS number precision loss on large Strava IDs.
    const minimal = data.map((a) => ({
      id: String(a.id),
      name: a.name,
      sport_type: a.sport_type,
      start_date: a.start_date,
      distance: a.distance,
      moving_time: a.moving_time,
      total_elevation_gain: a.total_elevation_gain,
      average_speed: a.average_speed,
      max_speed: a.max_speed,
    }));

    return NextResponse.json(minimal, {
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
    if (status === 504) {
      return new NextResponse("Strava timed out. Try again in a moment.", {
        status: 504,
        headers: { "cache-control": "no-store" },
      });
    }
    return new NextResponse("Failed to load activities.", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }
}

