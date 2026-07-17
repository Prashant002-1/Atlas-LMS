"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * The light/dark toggle that lives in the sidebar's identity row: one small
 * button showing the theme it switches to. It writes data-theme on the
 * document root and persists to localStorage; the no-flash init script in the
 * root layout reads it back on load. The current theme is read straight from
 * the document through a sync external store, so there is no effect and no
 * hydration mismatch.
 */

type Theme = "light" | "dark";

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function getServerSnapshot(): Theme {
  return "dark";
}

export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "menu" }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  if (variant === "menu") {
    return (
      <button
        type="button"
        role="menuitem"
        aria-label={label}
        onClick={() => setTheme(next)}
        className="flex min-h-9 w-full items-center gap-2.5 rounded-row px-2.5 text-left text-[0.8125rem] font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
      >
        {theme === "light" ? <Moon size={15} strokeWidth={2} aria-hidden /> : <Sun size={15} strokeWidth={2} aria-hidden />}
        <span>Theme</span>
        <span className="ml-auto text-[0.6875rem] font-normal text-[var(--color-faint)]">{theme === "light" ? "Light" : "Dark"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(next)}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-control text-[var(--color-faint)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
    >
      {theme === "light" ? <Moon size={14} strokeWidth={2} aria-hidden /> : <Sun size={14} strokeWidth={2} aria-hidden />}
    </button>
  );
}

function setTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem("atlas-theme", theme);
  } catch {
    // Storage can be unavailable (private mode); the choice still applies for this session.
  }
}
