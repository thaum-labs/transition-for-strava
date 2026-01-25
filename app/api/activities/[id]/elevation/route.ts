import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, setSession } from "@/src/lib/session";
import { checkRateLimit } from "@/src/lib/rateLimiter";
import { ensureFreshSession, stravaGetJsonWithRefresh } from "@/src/lib/strava";

export const runtime = "nodejs";

const ParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, "Invalid activity id."),
});

type StravaStream = { data?: unknown };
type StravaStreamSet = {
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

// Simplify altitude data to ~50 points for efficient rendering
function simplifyAltitudes(altitudes: number[], targetPoints = 50): number[] {
  if (altitudes.length <= targetPoints) return altitudes;
  
  const step = altitudes.length / targetPoints;
  const simplified: number[] = [];
  
  for (let i = 0; i < targetPoints; i++) {
    const idx = Math.floor(i * step);
    simplified.push(altitudes[idx]);
  }
  
  return simplified;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const parsedParams = ParamsSchema.safeParse({ id });
  if (!parsedParams.success) {
    return NextResponse.json(
      { altitudes: [] },
      { status: 400, headers: { "cache-control": "public, max-age=3600" } },
    );
  }

  const activityId = parsedParams.data.id;
  const rl = checkRateLimit({
    key: `elevation:${activityId}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { altitudes: [] },
      { status: 429, headers: { "cache-control": "public, max-age=60" } },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { altitudes: [] },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const { session: fresh, refreshed } = await ensureFreshSession(session);

  try {
    const { data, session: updatedSession, refreshed: tokenRefreshed } =
      await stravaGetJsonWithRefresh<StravaStreamSet>(
        `/activities/${activityId}/streams?keys=altitude&key_by_type=true`,
        fresh,
      );
    if (refreshed || tokenRefreshed) await setSession(updatedSession);

    const altitudes = toNumberArray(streamArray(data.altitude));
    
    if (!altitudes || altitudes.length < 2) {
      return NextResponse.json(
        { altitudes: [] },
        { headers: { "cache-control": "public, max-age=3600" } },
      );
    }

    const simplified = simplifyAltitudes(altitudes);

    return NextResponse.json(
      { altitudes: simplified },
      { headers: { "cache-control": "public, max-age=3600" } },
    );
  } catch {
    return NextResponse.json(
      { altitudes: [] },
      { headers: { "cache-control": "public, max-age=300" } },
    );
  }
}
