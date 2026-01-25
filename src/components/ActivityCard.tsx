export type ActivitySummary = {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  distance: number;
  moving_time: number;
};

function formatDistanceMeters(meters: number) {
  if (!Number.isFinite(meters)) return "—";
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 2 : 1)} km`;
}

function formatDurationSeconds(seconds: number) {
  if (!Number.isFinite(seconds)) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function ActivityCard({
  activity,
  onExport,
}: {
  activity: ActivitySummary;
  onExport: () => void;
}) {
  const date = new Date(activity.start_date);
  const dateText = Number.isNaN(date.getTime())
    ? activity.start_date
    : date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{activity.name}</div>
          <div className="mt-1 text-xs text-zinc-400">
            {activity.sport_type} • {dateText}
          </div>
          <div className="mt-2 text-sm text-zinc-200">
            {formatDistanceMeters(activity.distance)} •{" "}
            {formatDurationSeconds(activity.moving_time)}
          </div>
        </div>

        <button
          type="button"
          onClick={onExport}
          className="rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-black active:bg-zinc-200"
        >
          Export
        </button>
      </div>
    </div>
  );
}

