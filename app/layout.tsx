import type { Metadata } from "next";
import { MotionConfig } from "framer-motion";
import localFont from "next/font/local";
import "./globals.css";

/*
 * Fonts ship with the repo as base64 (assets/fonts), decoded to public/fonts
 * by the postinstall step, so builds are hermetic: no Google Fonts fetch at
 * build time, identical output in CI, Docker, and offline dev. Geist Sans
 * sets UI and prose; Geist Mono sets code, data, and tabular figures.
 */
const geistSans = localFont({
  src: [{ path: "../public/fonts/geist-sans-variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: [{ path: "../public/fonts/geist-mono-variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-geist-mono",
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

/*
 * Apply the saved theme before first paint so there is no flash. The default
 * is the dark theme (no attribute); a stored choice sets data-theme on the
 * document root, which the token sheet keys light/dark off.
 */
const themeInit =
  "(function(){try{var t=localStorage.getItem('atlas-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {/* Honour prefers-reduced-motion for every motion component below. */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </body>
    </html>
  );
}
