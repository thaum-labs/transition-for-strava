"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActivityCard, type ActivitySummary } from "@/src/components/ActivityCard";
import { ExportSheet } from "@/src/components/ExportSheet";

type DateRange = "7d" | "30d" | "today";

function daysAgoToUnixSeconds(days: number) {
  return Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
}

function startOfTodayUnixSeconds(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

export default function ActivitiesPage() {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivitySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedActivity, setSelectedActivity] =
    useState<ActivitySummary | null>(null);
  const [lastFormat, setLastFormat] = useState<"gpx" | "fit" | null>(null);

  const [range, setRange] = useState<DateRange>("30d");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    router.push("/");
  }

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/csrf", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const json = (await res.json()) as { token: string };
      setCsrfToken(json.token);
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      setError(null);
      setActivities(null);

      const after =
        range === "7d"
          ? daysAgoToUnixSeconds(7)
          : range === "30d"
            ? daysAgoToUnixSeconds(30)
            : startOfTodayUnixSeconds();

      const url = new URL("/api/activities", window.location.origin);
      url.searchParams.set("per_page", "30");
      url.searchParams.set("page", "1");
      url.searchParams.set("after", String(after));

      const res = await fetch(url.toString(), {
        cache: "no-store",
        credentials: "include",
      });
      if (res.status === 401) {
        setError("You’re not logged in. Please connect Strava again.");
        setActivities([]);
        return;
      }
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        setError(msg || "Failed to load activities.");
        setActivities([]);
        return;
      }

      const json = (await res.json()) as ActivitySummary[];
      setActivities(json);
    })();
  }, [range]);

  const filtered = useMemo(() => {
    const list = activities ?? [];
    const q = query.trim().toLowerCase();
    const filtered = list.filter((a) => {
      if (typeFilter !== "all" && a.sport_type !== typeFilter) return false;
      if (q && !a.name.toLowerCase().includes(q)) return false;
      return true;
    });
    // Sort by start_date descending (most recent first)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.start_date).getTime();
      const dateB = new Date(b.start_date).getTime();
      return dateB - dateA; // Descending order
    });
  }, [activities, query, typeFilter]);

  const sportTypes = useMemo(() => {
    const set = new Set<string>();
    for (const a of activities ?? []) set.add(a.sport_type);
    return ["all", ...Array.from(set).sort()];
  }, [activities]);

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Activities</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-200"
          >
            Log out
          </button>
        </div>
        <p className="text-xs text-zinc-400">
          Pick a time range, filter or search, then tap <strong>Export</strong> on
          an activity to download GPX or FIT.{" "}
          <Link href="/segments" className="text-amber-400 hover:underline">
            Track segments
          </Link>
        </p>
      </header>

      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="flex gap-2">
          {(["7d", "30d", "today"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={[
                "flex-1 rounded-lg px-3 py-2 text-sm font-semibold",
                r === range
                  ? "bg-orange-500 text-black"
                  : "border border-zinc-800 text-zinc-200",
              ].join(" ")}
            >
              {r === "today" ? "Today" : r.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <select
            className="w-1/2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            {sportTypes.map((t) => (
              <option key={t} value={t}>
                {t === "all" ? "All types" : t}
              </option>
            ))}
          </select>
          <input
            className="w-1/2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            placeholder="Search name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">
          {error}
        </section>
      ) : null}

      <section className="space-y-3">
        {activities === null ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-200">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-200">
            No activities found for this range.
          </div>
        ) : (
          filtered.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              onExport={() => setSelectedActivity(a)}
            />
          ))
        )}
      </section>

      <ExportSheet
        open={!!selectedActivity}
        activity={selectedActivity}
        csrfToken={csrfToken}
        defaultFormat={lastFormat}
        onClose={() => setSelectedActivity(null)}
        onFormatUsed={(f) => setLastFormat(f)}
      />
    </main>
  );
}

