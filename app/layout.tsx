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
          {children}
        </div>
      </body>
    </html>
  );
}

