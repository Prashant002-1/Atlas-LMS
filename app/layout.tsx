import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas LMS - course record for teaching and study",
  description:
    "Atlas keeps course design, practice, and study grounded in one course record.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
