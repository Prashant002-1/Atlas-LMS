# Atlas Design System

The tokens in `app/globals.css` are the source of truth. This note describes the intent so it stays legible, not to lock it down.

## Foundation

- Palette: cool neutral ground and white surfaces, charcoal ink, indigo for structure, one cyan for current state and progress, green for confirmed. Amber and red are reserved for real signals, never decoration.
- Type: Spectral for titles, statements, and reading; Hanken Grotesk for interface chrome; IBM Plex Mono for figures, codes, and labels. Loaded in `app/layout.tsx` and exposed as `--font-serif`, `--font-sans`, `--font-mono`.
- Shape: radii of 8px or less, fine borders over shadows.
- Motion: one easing curve, short transitions, reduced motion respected.

## Mark

A course aperture: measured top ticks, converging paths, and a single point of orientation, drawn in white on a very dark hunter green tile. The same asset is used for the sidebar mark, wordmark lockup, command surfaces, and browser icon. Asset at `public/brand/atlas-mark.svg`; rendered by `BrandMark` and `AtlasMark` in `components/atlas/primitives.tsx`.

## Surfaces

The product does not paint decorative or implied-data backgrounds. Records carry the screen; identity stays in the mark, the type, and a restrained accent.

## Components

Shared primitives live in `components/atlas/`. Prefer extending them over adding one-off UI.
