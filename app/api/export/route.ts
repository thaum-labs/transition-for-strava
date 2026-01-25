import { NextResponse } from "next/server";
import { z } from "zod";
import { buildGpx } from "@/src/lib/gpx";
import { buildFit } from "@/src/lib/fit";
import { checkRateLimit } from "@/src/lib/rateLimiter";
import { getSession, readCsrfToken, setSession } from "@/src/lib/session";
import { ensureFreshSession, stravaGetJsonWithRefresh } from "@/src/lib/strava";

export const runtime = "nodejs";

const QuerySchema = z.object({
  activityId: z.string().regex(/^\d+$/, "Invalid activity id."),
  format: z.enum(["gpx", "fit"]),
  sportType: z.coerce.number().int().min(0).max(255).optional(),
});

type StravaActivityDetail = {
  id: number;
  name: string;
  start_date: string;
};

type StravaStream = { data?: unknown };
type StravaStreamSet = {
  latlng?: StravaStream;
  time?: StravaStream;
  altitude?: StravaStream;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function hasDataArray(v: unknown): v is { data: unknown[] } {
  return isRecord(v) && Array.isArray(v.data);
}

function streamArray(v: unknown): unknown[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v;
  if (hasDataArray(v)) return v.data;
  return null;
}

function toLatLngPairs(v: unknown[] | null): [number, number][] | null {
  if (!v) return null;
  const out: [number, number][] = [];
  for (const item of v) {
    if (!Array.isArray(item) || item.length !== 2) return null;
    const lat = Number(item[0]);
    const lon = Number(item[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    out.push([lat, lon]);
  }
  return out;
}

function toNumberArray(v: unknown[] | null): number[] | null {
  if (!v) return null;
  const out: number[] = [];
  for (const item of v) {
    const n = Number(item);
    if (!Number.isFinite(n)) return null;
    out.push(n);
  }
  return out;
}

export async function GET(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const rl = checkRateLimit({
    key: `export:${ip}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return new NextResponse("Too many exports. Please try again.", {
      status: 429,
      headers: {
        "retry-after": String(rl.retryAfterSeconds ?? 60),
        "cache-control": "no-store",
      },
    });
  }

  const csrfHeader = req.headers.get("x-csrf-token");
  const csrfCookie = await readCsrfToken();
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
    return new NextResponse("CSRF check failed.", {
      status: 403,
      headers: { "cache-control": "no-store" },
    });
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return new NextResponse("Invalid request.", {
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
    const activityResult = await stravaGetJsonWithRefresh<StravaActivityDetail>(
      `/activities/${parsed.data.activityId}`,
      fresh,
    );
    const streamsResult = await stravaGetJsonWithRefresh<StravaStreamSet>(
      `/activities/${parsed.data.activityId}/streams?keys=latlng,time,altitude&key_by_type=true`,
      activityResult.session,
    );
    if (refreshed || activityResult.refreshed || streamsResult.refreshed) {
      await setSession(streamsResult.session);
    }

    const activity = activityResult.data;
    const streams = streamsResult.data;

    const latlng = toLatLngPairs(streamArray(streams.latlng));
    const time = toNumberArray(streamArray(streams.time));
    const altitude = toNumberArray(streamArray(streams.altitude));

    if (!latlng || latlng.length < 2) {
      return new NextResponse("No GPS track available for this activity.", {
        status: 400,
        headers: { "cache-control": "no-store" },
      });
    }

    const startDateUtc = new Date(activity.start_date);
    if (Number.isNaN(startDateUtc.getTime())) {
      return new NextResponse("Could not determine activity start time.", {
        status: 502,
        headers: { "cache-control": "no-store" },
      });
    }

    const gpx = buildGpx({
      activityName: activity.name,
      startDateUtc,
      streams: { latlng, time: time ?? undefined, altitude: altitude ?? undefined },
    });

    // Avoid bigint precision issues: use the requested id (string) for the filename.
    const filenameBase = `strava-activity-${parsed.data.activityId}`;

    if (parsed.data.format === "gpx") {
      return new NextResponse(gpx, {
        status: 200,
        headers: {
          "content-type": "application/gpx+xml; charset=utf-8",
          "content-disposition": `attachment; filename="${filenameBase}.gpx"`,
          "cache-control": "no-store",
        },
      });
    }

    // FIT is generated using Garmin FIT SDK with proper session/sport messages
    const sportType = parsed.data.sportType ?? 2; // Default to cycling (sport type 2)
    const fitBytes = buildFit({
      activityName: activity.name,
      startDateUtc,
      streams: { latlng, time: time ?? undefined, altitude: altitude ?? undefined },
      options: { sportType },
    });
    const fitBody = Buffer.from(fitBytes);
    return new NextResponse(fitBody, {
      status: 200,
      headers: {
        "content-type": "application/vnd.ant.fit",
        "content-disposition": `attachment; filename="${filenameBase}.fit"`,
        "cache-control": "no-store",
      },
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
    return new NextResponse("Export failed.", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }
}

