"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatChartDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Date for table: respects user's locale (browser/OS preferences). */
function formatEffortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type SegmentEffortRow = {
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

const CHART_PAD = { left: 4, right: 22, top: 6, bottom: 20 };
const CHART_VIEW = { w: 280, h: 120 };

function SegmentChart({ efforts }: { efforts: SegmentEffortRow[] }) {
  if (efforts.length === 0) return null;
  const sorted = [...efforts].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
  );
  const dates = sorted.map((r) => new Date(r.start_date).getTime());
  const times = sorted.map((r) => r.elapsed_time);
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const dateRange = maxDate - minDate || 86400000;
  const timeRange = maxTime - minTime || 60;

  const cw = CHART_VIEW.w - CHART_PAD.left - CHART_PAD.right;
  const ch = CHART_VIEW.h - CHART_PAD.top - CHART_PAD.bottom;

  const x = (t: number) =>
    CHART_PAD.left + ((t - minDate) / dateRange) * cw;
  const y = (elapsed: number) =>
    CHART_PAD.top + ch - ((elapsed - minTime) / timeRange) * ch;

  const points = sorted.map((r) => ({
    x: x(new Date(r.start_date).getTime()),
    y: y(r.elapsed_time),
    ...r,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const fastestPoint = points.find((p) => p.is_fastest);
  const yTicks =
    timeRange > 0
      ? [minTime, minTime + timeRange * 0.5, maxTime]
      : [minTime - 30, minTime, minTime + 30];
  const rightLabels = yTicks.map((t) => ({
    t,
    y: CHART_PAD.top + ch - ((t - minTime) / (timeRange || 1)) * ch,
  }));

  const xTicks =
    dateRange > 0
      ? [minDate, minDate + dateRange * 0.5, maxDate]
      : [minDate - 86400000, minDate, minDate + 86400000];
  const bottomLabels = xTicks.map((d) => ({
    label: formatChartDate(new Date(d).toISOString()),
    x: CHART_PAD.left + ((d - minDate) / (dateRange || 1)) * cw,
  }));

  return (
    <figure className="my-2 w-full" aria-label="Effort timeline">
      <svg
        viewBox={`0 0 ${CHART_VIEW.w} ${CHART_VIEW.h}`}
        className="h-28 w-full"
        preserveAspectRatio="none"
      >
        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#f97216"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.is_fastest ? 5 : 3.5}
            fill={p.is_fastest ? "#f97216" : "rgb(39,39,42)"}
            stroke="#f97216"
            strokeWidth={p.is_fastest ? 2 : 1}
          />
        ))}
        {/* Star on fastest (point is already highlighted with larger circle; ★ above) */}
        {fastestPoint && (
          <text
            x={fastestPoint.x}
            y={fastestPoint.y - 8}
            textAnchor="middle"
            style={{ fill: "#f97216", fontSize: 10 }}
          >
            ★
          </text>
        )}
        {/* Y labels (time, right) */}
        {rightLabels.map(({ t, y: yy }, i) => (
          <text
            key={i}
            x={CHART_VIEW.w - 4}
            y={yy + 3}
            textAnchor="end"
            className="fill-zinc-500 text-[9px]"
          >
            {formatElapsed(t)}
          </text>
        ))}
        {/* X labels (dates, bottom) */}
        {bottomLabels.map(({ label, x: xx }, i) => (
          <text
            key={i}
            x={xx}
            y={CHART_VIEW.h - 4}
            textAnchor="middle"
            className="fill-zinc-500 text-[9px]"
          >
            {label}
          </text>
        ))}
      </svg>
    </figure>
  );
}

type SegmentDetail = {
  name: string;
  distance: number;
  total_elevation_gain?: number;
  average_grade?: number;
};

type EffortsResult =
  | { efforts: SegmentEffortRow[] }
  | { error: string }
  | null;

function SegmentBlock({
  segmentId,
  initialDetail,
  effortsResult,
}: {
  segmentId: string;
  initialDetail: SegmentDetail | null;
  effortsResult: EffortsResult;
}) {
  const [detail, setDetail] = useState<SegmentDetail | null>(initialDetail);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDetail) return;
    let cancelled = false;
    setDetailError(null);
    void (async () => {
      const base = window.location.origin;
      const segRes = await fetch(
        `${base}/api/segments/${encodeURIComponent(segmentId)}`,
        { cache: "no-store", credentials: "include" },
      );
      if (cancelled) return;
      if (!segRes.ok) {
        setDetailError("Failed to load segment.");
        return;
      }
      try {
        const segJson = (await segRes.json()) as SegmentDetail;
        if (!cancelled) setDetail(segJson);
      } catch {
        if (!cancelled) setDetailError("Failed to load segment.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialDetail, segmentId]);

  const loading = detail === null && detailError === null;
  const efforts =
    effortsResult && "efforts" in effortsResult ? effortsResult.efforts : null;
  const effortsError =
    effortsResult && "error" in effortsResult ? effortsResult.error : null;
  const error = detailError ?? effortsError;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="min-w-0 flex-1">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading segment…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : detail ? (
          <>
            <h3 className="truncate text-sm font-semibold text-zinc-100">
              {detail.name}
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              {Math.round(detail.distance)} m
              {detail.total_elevation_gain != null &&
                ` · ${Math.round(detail.total_elevation_gain)} m elev`}
              {detail.average_grade != null &&
                ` · ${detail.average_grade.toFixed(1)}% avg gradient`}
            </p>
          </>
        ) : null}
      </div>

      {detail && !detailError && (
        <div className="mt-3 overflow-x-auto">
          {effortsResult === null ? (
            <p className="text-xs text-zinc-500">Loading efforts…</p>
          ) : effortsError ? (
            <p className="text-xs text-red-400">{effortsError}</p>
          ) : efforts && efforts.length > 0 ? (
            <>
              <SegmentChart efforts={efforts} />
              <table className="w-full min-w-[320px] text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-400">
                  <th className="py-1.5 pr-2 font-medium">Date</th>
                  <th className="py-1.5 pr-2 font-medium">Time</th>
                  <th className="py-1.5 pr-2 font-medium">Speed</th>
                  <th className="py-1.5 pr-2 font-medium">Power</th>
                  <th className="py-1.5 pr-2 font-medium">VAM</th>
                  <th className="py-1.5 pr-2 font-medium">Heart rate</th>
                </tr>
              </thead>
              <tbody className="text-zinc-200">
                {efforts.map((row, i) => (
                  <tr key={i} className="border-b border-zinc-800/80">
                    <td className="py-1.5 pr-2 whitespace-nowrap">
                      {formatEffortDate(row.start_date)}
                    </td>
                    <td className="py-1.5 pr-2">
                      <span className="inline-flex items-center gap-1">
                        {row.is_fastest && (
                          <span
                            className="text-[#f97216]"
                            title="Fastest time"
                            aria-label="Fastest time"
                          >
                            ★
                          </span>
                        )}
                        {formatElapsed(row.elapsed_time)}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2">
                      {row.speed_kmh != null ? `${row.speed_kmh} km/h` : "—"}
                    </td>
                    <td className="py-1.5 pr-2">
                      {row.average_watts != null ? `${row.average_watts} W` : "—"}
                    </td>
                    <td className="py-1.5 pr-2">
                      {row.vam_mh != null ? `${row.vam_mh} m/h` : "—"}
                    </td>
                    <td className="py-1.5 pr-2">
                      {row.average_heartrate != null
                        ? `${row.average_heartrate} bpm`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          ) : (
            <p className="text-xs text-zinc-500">No attempts on this segment.</p>
          )}
        </div>
      )}
    </div>
  );
}

type StarredSegment = {
  id: string;
  name: string;
  distance: number;
  total_elevation_gain?: number;
  average_grade?: number;
};

type EffortsBatchResult = Record<
  string,
  { efforts: SegmentEffortRow[] } | { error: string }
>;

export default function SegmentsPage() {
  const [starred, setStarred] = useState<StarredSegment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [effortsBatch, setEffortsBatch] = useState<EffortsBatchResult | null>(
    null,
  );
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void (async () => {
      const res = await fetch("/api/segments/starred", {
        cache: "no-store",
        credentials: "include",
      });
      if (cancelled) return;
      if (res.status === 401) {
        setError("You're not logged in. Please connect Strava from the home page.");
        setStarred([]);
        return;
      }
      if (!res.ok) {
        setError("Failed to load your starred segments.");
        setStarred([]);
        return;
      }
      const data = (await res.json()) as StarredSegment[];
      setStarred(data);
      setEffortsBatch(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!starred || starred.length === 0) {
      setBatchLoading(false);
      return;
    }
    let cancelled = false;
    setBatchLoading(true);
    setEffortsBatch(null);
    void (async () => {
      try {
        const res = await fetch("/api/segments/efforts-batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            segmentIds: starred.map((s) => s.id),
          }),
          cache: "no-store",
          credentials: "include",
        });
        if (cancelled) return;
        if (!res.ok) {
          const fallback: EffortsBatchResult = {};
          starred.forEach((s) => {
            fallback[s.id] = { error: "Failed to load efforts." };
          });
          setEffortsBatch(fallback);
          setBatchLoading(false);
          return;
        }
        const data = (await res.json()) as EffortsBatchResult;
        if (!cancelled) {
          setEffortsBatch(data);
        }
      } catch {
        const fallback: EffortsBatchResult = {};
        starred.forEach((s) => {
          fallback[s.id] = { error: "Failed to load efforts." };
        });
        if (!cancelled) setEffortsBatch(fallback);
      } finally {
        if (!cancelled) setBatchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [starred]);

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/activities"
              className="shrink-0 text-zinc-400 hover:text-zinc-200"
              aria-label="Back to activities"
            >
              ←
            </Link>
            <h1 className="truncate text-xl font-semibold">Segments</h1>
          </div>
        </div>
        <p className="text-xs text-zinc-400">
          Shows your starred segments from{" "}
          <a
            href="https://www.strava.com/athlete/segments/starred"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#f97216] hover:underline"
          >
            Strava → My Segments
          </a>
          . Star or unstar segments there to change this list. Your 5 most recent attempts plus your fastest time (★) are shown below.
        </p>
      </header>

      {error ? (
        <section className="rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">
          {error}
        </section>
      ) : null}

      <section className="space-y-3">
        {starred === null ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
            Loading your starred segments…
          </div>
        ) : starred.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
            You have no starred segments. Star segments on Strava (
            <a
              href="https://www.strava.com/athlete/segments/starred"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#f97216] hover:underline"
            >
              My Segments
            </a>
            ) to see them here with your best 5 attempts.
          </div>
        ) : (
          starred.map((seg) => (
            <SegmentBlock
              key={seg.id}
              segmentId={seg.id}
              initialDetail={{
                name: seg.name,
                distance: seg.distance,
                total_elevation_gain: seg.total_elevation_gain,
                average_grade: seg.average_grade,
              }}
              effortsResult={
                batchLoading ? null : effortsBatch?.[seg.id] ?? null
              }
            />
          ))
        )}
      </section>
    </main>
  );
}
