# Atlas Design System

The tokens in `app/globals.css` are the source of truth. This note describes the intent so it stays legible, not to lock it down.

## Foundation

- Palette: a near-monochrome neutral scale carries the UI and one Atlas emerald signals brand, primary action, focus, and the live state. Dark is the default theme; light ships behind `[data-theme="light"]`. Amber and red are reserved for real signals, never decoration.
- Type: Geist Sans for interface and reading, Geist Mono for figures, codes, and labels. Vendored in `assets/fonts`, decoded by the postinstall step, loaded in `app/layout.tsx`, and exposed as `--font-serif`, `--font-sans`, `--font-mono`.
- Scale: the root type size is 110% and every text and component size is rem-based, so the whole interface renders full without browser zoom. Hairline borders, radii, and icon glyphs stay in px so edges and marks remain crisp.
- Shape: one sharp radius scale, fixed. Controls 4px, rows and badges 6px, panels 8px, declared as theme tokens so the semantic utilities `rounded-control`, `rounded-row`, `rounded-panel` are the only radii components use. `rounded-full` is reserved for true circles (avatars, dots) and hairline rails. Fine borders over shadows.
- Motion: one easing curve, short transitions, reduced motion respected.

## Mark

A course aperture: measured top ticks, converging paths, and a single point of orientation, drawn in white on a very dark hunter green tile. The tiled logo (`public/brand/atlas-mark.svg`, rendered by `BrandMark` and `AtlasMark`) is for logo contexts: sign-in, the browser icon. Everywhere Atlas appears as an icon rather than the logo, including the sidebar, use the icon-weight variant: the geometry alone in currentColor (`public/brand/atlas-icon.svg`, rendered by `AtlasIcon` in `components/atlas/primitives.tsx`).

## Surfaces

The product does not paint decorative or implied-data backgrounds. Records carry the screen; identity stays in the mark, the type, and a restrained accent.

## Interaction Posture

Show the record and direct controls. Do not assign work to the user, narrate their attention, or teach them an ordinary interface. Labels name the actual object or state: `Work`, `Modules`, `Announcements`, `Students`, `Due Jun 28`, `8 submitted`, `Live`, `Draft`.

- Do not use dashboard language such as `Needs action`, `Next`, `To do`, `course health`, generic `insights`, or tutorial hints.
- A status is a fact, not an instruction. It may show a count, date, state, or direct consequence.
- Name things what they are: course, work, module, announcement, grades. Doctrine words like "course record" belong to the docs; the interface says course.
- No explainer sentences on controls everyone knows. Sign out is `Sign out`, a theme toggle is a theme toggle.
- Atlas is represented by the mark or a plain label, never sparkle or wand iconography.
- Give navigation and controls a visible, restrained signifier before hover. Hover and focus confirm an available action; they do not reveal that an otherwise identical surface is clickable.
- The student agent may guide a student within a professor-defined learning contract. This rule applies to the ordinary LMS interface, especially professor surfaces.

## Components

Shared primitives live in `components/atlas/`. Prefer extending them over adding one-off UI.
