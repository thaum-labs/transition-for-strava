import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter } from "@/src/components/SiteFooter";

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
        <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 py-6">
          <div className="flex items-center justify-between pb-2">
            <span className="rounded-full border border-[#f97216] bg-[#f97216] px-2.5 py-0.5 text-xs font-medium text-white">
              Beta
            </span>
          </div>
          <div className="flex-1">{children}</div>
          <div className="pt-8">
            <SiteFooter />
          </div>
        </div>
      </body>
    </html>
  );
}
