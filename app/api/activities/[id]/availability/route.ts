import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, setSession } from "@/src/lib/session";
import { isProd } from "@/src/lib/env";
import { checkRateLimit } from "@/src/lib/rateLimiter";
import { ensureFreshSession, stravaGetJsonWithRefresh } from "@/src/lib/strava";

export const runtime = "nodejs";

const ParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, "Invalid activity id."),
});

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Next.js 15: route params are provided as a Promise.
  const { id } = await params;

  const parsedParams = ParamsSchema.safeParse({ id });
  if (!parsedParams.success) {
    return NextResponse.json(
      {
        gpx: { available: false, reason: "Invalid activity id." },
        fit: { available: false, reason: "Invalid activity id." },
      },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const activityId = parsedParams.data.id;
  const rl = checkRateLimit({
    key: `availability:${activityId}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        gpx: { available: false, reason: "Rate limited. Try again shortly." },
        fit: { available: false, reason: "Rate limited. Try again shortly." },
      },
      { status: 429, headers: { "cache-control": "no-store" } },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      {
        gpx: { available: false, reason: "Not authorized. Please log out and reconnect Strava." },
        fit: { available: false, reason: "Not authorized. Please log out and reconnect Strava." },
      },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const { session: fresh, refreshed } = await ensureFreshSession(session);

  try {
    const { data, session: updatedSession, refreshed: tokenRefreshed } =
      await stravaGetJsonWithRefresh<StravaStreamSet>(
        `/activities/${activityId}/streams?keys=latlng,time,altitude&key_by_type=true`,
        fresh,
      );
    if (refreshed || tokenRefreshed) await setSession(updatedSession);

    const latlng = streamArray(data.latlng);
    const hasGps = !!latlng && latlng.length >= 2;

    return NextResponse.json(
      {
        gpx: hasGps
          ? { available: true }
          : { available: false, reason: "No GPS track available for this activity." },
        fit: hasGps
          ? { available: true }
          : { available: false, reason: "No GPS track available for this activity." },
        notes: ["FIT is generated from Strava streams (not the original upload)."],
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e: unknown) {
    const status =
      isRecord(e) && typeof e.status === "number" ? (e.status as number) : 502;
    if (status === 401) {
      return NextResponse.json(
        {
          gpx: { available: false, reason: "Not authorized. Please log out and reconnect Strava." },
          fit: { available: false, reason: "Not authorized. Please log out and reconnect Strava." },
        },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }
    if (status === 403 || status === 404) {
      // 403/404 often means insufficient scope or activity not accessible
      return NextResponse.json(
        {
          gpx: { available: false, reason: "Activity streams not accessible. Ensure you approved 'activity:read_all' scope." },
          fit: { available: false, reason: "Activity streams not accessible. Ensure you approved 'activity:read_all' scope." },
        },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }
    if (status === 429) {
      return NextResponse.json(
        {
          gpx: { available: false, reason: "Strava rate limit reached. Try again later." },
          fit: { available: false, reason: "Strava rate limit reached. Try again later." },
        },
        { status: 429, headers: { "cache-control": "no-store" } },
      );
    }
    // Log the actual error for debugging (but don't expose it to user)
    const message = isRecord(e) && typeof e.message === "string" ? e.message : "";
    console.error("Availability check failed:", message || String(e));
    const debugReason = !isProd() ? ` ${message}`.trim() : "";
    return NextResponse.json(
      {
        gpx: {
          available: false,
          reason: `Could not check availability.${debugReason ? ` ${debugReason}` : ""}`.trim(),
        },
        fit: {
          available: false,
          reason: `Could not check availability.${debugReason ? ` ${debugReason}` : ""}`.trim(),
        },
      },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}

