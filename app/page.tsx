import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="space-y-6">
      <header className="space-y-4 text-center">
        <div className="flex justify-center">
          <Image
            src="/logo.png"
            alt="Transition app logo"
            width={120}
            height={120}
            className="rounded-2xl"
            priority
            style={{ background: "transparent" }}
          />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Transition for Strava</h1>
          <p className="text-sm font-medium text-zinc-200">
            Export your Strava activities as GPX or FIT files in one tap — then share
            or import them into other apps and devices.
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-center">
        <p className="text-sm text-zinc-300">
          Use it to back up rides, move activities to Garmin or Zepp, build custom
          maps, or keep a local archive. No account here — we only use Strava to
          log in and read your activities.
        </p>
      </section>

      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-500/20 px-4 py-2">
          <svg
            className="h-4 w-4 shrink-0 text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-xs text-blue-200">
            We use Strava OAuth. Tokens are stored only in an encrypted{" "}
            <span className="font-medium">httpOnly cookie</span> (not in
            localStorage).
          </p>
        </div>
      </div>

      <Link
        href="/api/auth/strava/start"
        className="block w-full rounded-xl bg-orange-500 px-4 py-3 text-center font-semibold text-black active:bg-orange-400"
      >
        Continue with Strava
      </Link>
    </main>
  );
}

