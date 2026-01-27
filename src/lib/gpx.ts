function escapeXml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export type Streams = {
  latlng: [number, number][];
  time?: number[]; // seconds since start
  altitude?: number[];
};

export function buildGpx(params: {
  activityName: string;
  startDateUtc: Date;
  streams: Streams;
  calories?: number;
}): string {
  const { activityName, startDateUtc, streams, calories } = params;
  const { latlng, time, altitude } = streams;

  const n = latlng.length;
  const hasTime = Array.isArray(time) && time.length === n;
  const hasAlt = Array.isArray(altitude) && altitude.length === n;

  const trkpts = latlng
    .map(([lat, lon], i) => {
      const ele = hasAlt ? `<ele>${altitude![i].toFixed(1)}</ele>` : "";
      const t = hasTime
        ? `<time>${new Date(startDateUtc.getTime() + time![i] * 1000).toISOString()}</time>`
        : "";
      return `<trkpt lat="${lat}" lon="${lon}">${ele}${t}</trkpt>`;
    })
    .join("");

  const nameXml = escapeXml(activityName || "Strava activity");
  const metaTime = startDateUtc.toISOString();
  
  // Add calories as extension in metadata if available
  const caloriesXml = calories !== undefined && calories > 0
    ? `    <extensions>
      <calories>${Math.round(calories)}</calories>
    </extensions>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Transition for Strava" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${nameXml}</name>
    <time>${metaTime}</time>${caloriesXml ? `\n${caloriesXml}` : ""}
  </metadata>
  <trk>
    <name>${nameXml}</name>
    <trkseg>${trkpts}</trkseg>
  </trk>
</gpx>
`;
}

