"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * The light/dark choice. Writes data-theme on the document root and persists
 * to localStorage; the no-flash init script in the root layout reads it back
 * on load. Lives on the Account page, the one place identity-level choices go.
 */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "dark";
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  });

  function applyTheme(next: "light" | "dark") {
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem("atlas-theme", next);
    } catch {
      // Storage can be unavailable (private mode); the choice still applies for this session.
    }
    setTheme(next);
  }

  const option = (value: "light" | "dark", label: string, Icon: typeof Sun) => (
    <button
      type="button"
      aria-pressed={theme === value}
      onClick={() => applyTheme(value)}
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-control px-2.5 text-[12.5px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)] ${
        theme === value
          ? "bg-[var(--color-indigo-soft)] text-[var(--color-ink)]"
          : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      }`}
    >
      <Icon size={13} strokeWidth={2} aria-hidden />
      {label}
    </button>
  );

  return (
    <div className="inline-flex rounded-control border border-[var(--color-border)] p-0.5">
      {option("light", "Light", Sun)}
      {option("dark", "Dark", Moon)}
    </div>
  );
}
