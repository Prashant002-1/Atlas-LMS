import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas LMS — the AI-native learning platform",
  description:
    "The agent builds courses for professors and tutors students inside them — every piece grounded in the professor's learning objectives, so nothing is a surprise.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
