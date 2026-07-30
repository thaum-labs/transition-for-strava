import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-zinc-800 pt-6 text-center text-xs text-zinc-500">
      <p className="leading-relaxed">
        Not affiliated with Strava. Strava is a trademark of Strava, Inc.
      </p>
      <p className="mt-2 leading-relaxed">
        Sessions use encrypted httpOnly cookies. Activity files are generated
        on demand and never stored.
      </p>
      <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <a
          href="https://github.com/thaum-labs/transition-for-strava"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 hover:text-zinc-200"
        >
          GitHub
        </a>
        <span aria-hidden className="text-zinc-700">
          ·
        </span>
        <a
          href="https://github.com/thaum-labs/transition-for-strava/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 hover:text-zinc-200"
        >
          Report an issue
        </a>
        <span aria-hidden className="text-zinc-700">
          ·
        </span>
        <Link href="/" className="text-zinc-400 hover:text-zinc-200">
          Home
        </Link>
      </p>
      <p className="mt-3 text-zinc-600">© {year} Thaum Labs</p>
    </footer>
  );
}
