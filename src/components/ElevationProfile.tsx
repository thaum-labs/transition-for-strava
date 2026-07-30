"use client";

import { useEffect, useRef, useState } from "react";

type ElevationProfileProps = {
  activityId: number | string;
  className?: string;
};

export function ElevationProfile({ activityId, className = "" }: ElevationProfileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [altitudes, setAltitudes] = useState<number[] | null>(null);

  // Lazy-load: only fetch when the card scrolls into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();

    void (async () => {
      try {
        const res = await fetch(`/api/activities/${activityId}/elevation`, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { altitudes: number[] };
        if (!controller.signal.aborted) {
          setAltitudes(data.altitudes);
        }
      } catch {
        // Silently fail - elevation profile is optional (incl. abort)
      }
    })();

    return () => controller.abort();
  }, [activityId, visible]);

  if (!altitudes || altitudes.length < 2) {
    return <div ref={containerRef} className="absolute inset-0" aria-hidden />;
  }

  // Normalize altitudes to 0-100 range for SVG
  const min = Math.min(...altitudes);
  const max = Math.max(...altitudes);
  const range = max - min;

  if (range < 5) {
    return <div ref={containerRef} className="absolute inset-0" aria-hidden />;
  }

  // Create SVG path
  const points = altitudes.map((alt, i) => {
    const x = (i / (altitudes.length - 1)) * 100;
    const y = 100 - ((alt - min) / range) * 100; // Invert Y axis for SVG
    return `${x},${y}`;
  });

  const pathData = `M 0,100 L ${points.join(" L ")} L 100,100 Z`;
  const gradientId = `elevationGradient-${activityId}`;

  return (
    <div ref={containerRef} className="absolute inset-0" aria-hidden>
      <svg
        className={`absolute inset-0 h-full w-full ${className}`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ pointerEvents: "none" }}
      >
        <path
          d={pathData}
          fill={`url(#${gradientId})`}
          opacity="0.4"
          stroke="#f97316"
          strokeWidth="0.5"
          strokeOpacity="0.5"
        />
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#f97316" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.2" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
