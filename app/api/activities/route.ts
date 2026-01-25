import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, setSession } from "@/src/lib/session";
import { checkRateLimit } from "@/src/lib/rateLimiter";
import { ensureFreshSession, stravaGetJson } from "@/src/lib/strava";

export const runtime = "nodejs";

const QuerySchema = z.object({
  per_page: z.coerce.number().int().min(1).max(200).default(30),
  page: z.coerce.number().int().min(1).max(50).default(1),
  before: z.coerce.number().int().positive().optional(),
  after: z.coerce.number().int().positive().optional(),
});

type StravaSummaryActivity = {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  distance: number;
  moving_time: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

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

  const { session: fresh, refreshed } = await ensureFreshSession(session);
  if (refreshed) await setSession(fresh);

  const qs = new URLSearchParams({
    per_page: String(parsed.data.per_page),
    page: String(parsed.data.page),
  });
  if (parsed.data.before) qs.set("before", String(parsed.data.before));
  if (parsed.data.after) qs.set("after", String(parsed.data.after));

  try {
    const { data } = await stravaGetJson<StravaSummaryActivity[]>(
      `/athlete/activities?${qs.toString()}`,
      fresh.strava.accessToken,
    );

    const minimal = data.map((a) => ({
      id: a.id,
      name: a.name,
      sport_type: a.sport_type,
      start_date: a.start_date,
      distance: a.distance,
      moving_time: a.moving_time,
    }));

    return NextResponse.json(minimal, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e: unknown) {
    const status =
      isRecord(e) && typeof e.status === "number" ? (e.status as number) : 502;
    if (status === 401) {
      // Session may be stale/invalid; the UI will prompt re-login.
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
    return new NextResponse("Failed to load activities.", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }
}

