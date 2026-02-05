import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Transition for Strava",
  description: "Export Strava activities as GPX or FIT (generated).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-50 antialiased">
        <div className="mx-auto min-h-dvh w-full max-w-xl px-4 py-6">
          <div className="flex items-center justify-between pb-2">
            <span className="rounded-full border border-amber-500/50 bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-200">
              Beta
            </span>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}

