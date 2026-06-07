# Atlas Design System

The tokens in `app/globals.css` are the source of truth. This note describes the intent so it stays legible, not to lock it down.

## Foundation

- Palette: cool neutral ground and white surfaces, charcoal ink, indigo for structure, one cyan for current state and progress, green for confirmed. Amber and red are reserved for real signals, never decoration.
- Type: Spectral for titles, statements, and reading; Hanken Grotesk for interface chrome; IBM Plex Mono for figures, codes, and labels. Loaded in `app/layout.tsx` and exposed as `--font-serif`, `--font-sans`, `--font-mono`.
- Shape: radii of 8px or less, fine borders over shadows.
- Motion: one easing curve, short transitions, reduced motion respected.

## Mark

A reticle: a ring, four cardinal ticks, a centered fix. The single cyan dot marks the point in focus. It scales by shedding detail, never by redrawing: full mark, then app icon, then a ring-and-fix favicon. Asset at `public/brand/atlas-mark.svg`, favicon `app/icon.svg`, component `BrandMark` in `components/atlas/primitives.tsx`.

## Surfaces

The product does not paint decorative or implied-data backgrounds. Records carry the screen; identity stays in the mark, the type, and a restrained accent.

## Components

Shared primitives live in `components/atlas/`. Prefer extending them over adding one-off UI.
