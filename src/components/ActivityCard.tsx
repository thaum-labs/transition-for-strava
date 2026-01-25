export type ActivitySummary = {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  distance: number;
  moving_time: number;
  total_elevation_gain?: number;
  average_speed?: number;
  max_speed?: number;
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

function formatSpeedMps(metersPerSecond: number | undefined) {
  if (!metersPerSecond || !Number.isFinite(metersPerSecond)) return null;
  const kmh = metersPerSecond * 3.6;
  return `${kmh.toFixed(1)} km/h`;
}

function formatElevationMeters(meters: number | undefined) {
  if (!meters || !Number.isFinite(meters)) return null;
  return `${Math.round(meters)} m`;
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

  const avgSpeed = formatSpeedMps(activity.average_speed);
  const maxSpeed = formatSpeedMps(activity.max_speed);
  const elevation = formatElevationMeters(activity.total_elevation_gain);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{activity.name}</div>
          <div className="mt-1 text-xs text-zinc-400">
            {activity.sport_type} • {dateText}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-200">
            <span>{formatDistanceMeters(activity.distance)}</span>
            <span>{formatDurationSeconds(activity.moving_time)}</span>
            {avgSpeed && <span>{avgSpeed} avg</span>}
            {maxSpeed && <span>{maxSpeed} max</span>}
            {elevation && <span>↗ {elevation}</span>}
          </div>
        </div>

        <button
          type="button"
          onClick={onExport}
          className="shrink-0 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-black active:bg-zinc-200"
        >
          Export
        </button>
      </div>
    </div>
  );
}

