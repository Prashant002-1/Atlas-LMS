import type { Metadata } from "next";
import { MotionConfig } from "framer-motion";
import localFont from "next/font/local";
import "./globals.css";

/*
 * Fonts ship with the repo (public/fonts, latin subsets) so builds are
 * hermetic, no Google Fonts fetch at build time, identical output in CI,
 * Docker, and offline dev.
 */
const spectral = localFont({
  src: [
    { path: "../public/fonts/spectral-300.woff2", weight: "300", style: "normal" },
    { path: "../public/fonts/spectral-300-italic.woff2", weight: "300", style: "italic" },
    { path: "../public/fonts/spectral-400.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/spectral-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../public/fonts/spectral-500.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/spectral-500-italic.woff2", weight: "500", style: "italic" },
  ],
  variable: "--font-spectral",
  display: "swap",
});

const hanken = localFont({
  src: [{ path: "../public/fonts/hanken-grotesk-variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-hanken",
  display: "swap",
});

const plexMono = localFont({
  src: [
    { path: "../public/fonts/ibm-plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/ibm-plex-mono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Atlas LMS, course record for teaching and study",
  description:
    "Atlas keeps course design, practice, and study grounded in one course record.",
  icons: {
    icon: "/brand/atlas-mark.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${spectral.variable} ${hanken.variable} ${plexMono.variable}`}>
      <body className="antialiased">
        {/* Honour prefers-reduced-motion for every motion component below. */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </body>
    </html>
  );
}
