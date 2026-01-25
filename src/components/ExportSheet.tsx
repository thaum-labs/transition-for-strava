"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActivitySummary } from "@/src/components/ActivityCard";

type Format = "gpx" | "fit";

type Availability = {
  gpx: { available: boolean; reason?: string };
  fit: { available: boolean; reason?: string };
  notes?: string[];
};

async function downloadFromResponse(res: Response, filenameFallback: string) {
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const match = cd.match(/filename="([^"]+)"/i);
  const filename = match?.[1] || filenameFallback;

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ExportSheet({
  open,
  activity,
  csrfToken,
  defaultFormat,
  onClose,
  onFormatUsed,
}: {
  open: boolean;
  activity: ActivitySummary | null;
  csrfToken: string | null;
  defaultFormat: Format | null;
  onClose: () => void;
  onFormatUsed: (format: Format) => void;
}) {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [didDownload, setDidDownload] = useState(false);

  const id = activity?.id ?? null;

  useEffect(() => {
    if (!open || !id) return;

    setAvailability(null);
    setActionError(null);
    setDidDownload(false);

    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/activities/${id}/availability`, {
          cache: "no-store",
        });
        if (!res.ok) {
          let reason = "Could not check availability.";
          try {
            const json = (await res.json()) as Availability;
            if (json.gpx?.reason) reason = json.gpx.reason;
          } catch {
            // Use default reason if JSON parse fails
          }
          setAvailability({
            gpx: { available: false, reason },
            fit: { available: false, reason },
          });
          return;
        }
        const json = (await res.json()) as Availability;
        setAvailability(json);
      } catch (err) {
        console.error("Availability check error:", err);
        setAvailability({
          gpx: { available: false, reason: "Network error. Check your connection." },
          fit: { available: false, reason: "Network error. Check your connection." },
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [open, id]);

  const recommendedFormat: Format | null = useMemo(() => {
    if (!availability) return defaultFormat;
    if (defaultFormat && availability[defaultFormat].available) return defaultFormat;
    if (availability.gpx.available) return "gpx";
    if (availability.fit.available) return "fit";
    return null;
  }, [availability, defaultFormat]);

  async function doExport(format: Format) {
    if (!activity) return;
    if (!csrfToken) {
      setActionError("Security token missing. Reload and try again.");
      return;
    }

    setActionError(null);
    setDidDownload(false);
    try {
      const url = new URL("/api/export", window.location.origin);
      url.searchParams.set("activityId", String(activity.id));
      url.searchParams.set("format", format);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { "x-csrf-token": csrfToken },
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        setActionError(msg || "Export failed.");
        return;
      }

      await downloadFromResponse(
        res,
        `strava-activity-${activity.id}.${format}`,
      );
      onFormatUsed(format);
      setDidDownload(true);
    } catch {
      setActionError("Export failed. Please try again.");
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">
              Export: {activity?.name ?? "Activity"}
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              Choose format for this activity.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-200"
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {loading || !availability ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-200">
              Checking availability…
            </div>
          ) : null}

          {availability?.notes?.length ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-300">
              {availability.notes.map((n, i) => (
                <div key={i}>{n}</div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            disabled={!availability?.gpx.available}
            onClick={() => doExport("gpx")}
            className={[
              "w-full rounded-xl px-4 py-3 text-left text-sm font-semibold",
              availability?.gpx.available
                ? recommendedFormat === "gpx"
                  ? "bg-orange-500 text-black"
                  : "bg-zinc-100 text-black"
                : "cursor-not-allowed border border-zinc-800 bg-zinc-900/40 text-zinc-500",
            ].join(" ")}
          >
            Export GPX
            {!availability?.gpx.available && availability?.gpx.reason ? (
              <div className="mt-1 text-xs font-normal">{availability.gpx.reason}</div>
            ) : null}
          </button>

          <button
            type="button"
            disabled={!availability?.fit.available}
            onClick={() => doExport("fit")}
            className={[
              "w-full rounded-xl px-4 py-3 text-left text-sm font-semibold",
              availability?.fit.available
                ? recommendedFormat === "fit"
                  ? "bg-orange-500 text-black"
                  : "bg-zinc-100 text-black"
                : "cursor-not-allowed border border-zinc-800 bg-zinc-900/40 text-zinc-500",
            ].join(" ")}
          >
            Export FIT
            <div className="mt-1 text-xs font-normal text-zinc-600">
              FIT is generated from streams (not the original upload).
            </div>
            {!availability?.fit.available && availability?.fit.reason ? (
              <div className="mt-1 text-xs font-normal">{availability.fit.reason}</div>
            ) : null}
          </button>

          {actionError ? (
            <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">
              {actionError}
            </div>
          ) : null}

          {didDownload ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-200">
              Download started. On iOS, open the file from Safari downloads / Files
              to share to another app.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

