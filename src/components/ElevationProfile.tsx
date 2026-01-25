"use client";

import { useEffect, useState } from "react";

type ElevationProfileProps = {
  activityId: number;
  className?: string;
};

export function ElevationProfile({ activityId, className = "" }: ElevationProfileProps) {
  const [altitudes, setAltitudes] = useState<number[] | null>(null);

  // Fetch altitude data
  useEffect(() => {
    let cancelled = false;
    
    void (async () => {
      try {
        const res = await fetch(`/api/activities/${activityId}/elevation`, {
          cache: "force-cache",
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { altitudes: number[] };
        if (!cancelled) {
          setAltitudes(data.altitudes);
        }
      } catch {
        // Silently fail - elevation profile is optional
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activityId]);

  if (!altitudes || altitudes.length < 2) {
    return null;
  }

  // Normalize altitudes to 0-100 range for SVG
  const min = Math.min(...altitudes);
  const max = Math.max(...altitudes);
  const range = max - min;
  
  if (range < 5) {
    return null; // Too flat, skip profile
  }

  // Create SVG path
  const points = altitudes.map((alt, i) => {
    const x = (i / (altitudes.length - 1)) * 100;
    const y = 100 - ((alt - min) / range) * 100; // Invert Y axis for SVG
    return `${x},${y}`;
  });

  const pathData = `M 0,100 L ${points.join(" L ")} L 100,100 Z`;

  return (
    <svg
      className={`absolute inset-0 h-full w-full ${className}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ pointerEvents: "none" }}
    >
      <path
        d={pathData}
        fill="url(#elevationGradient)"
        opacity="0.12"
      />
      <defs>
        <linearGradient id="elevationGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
