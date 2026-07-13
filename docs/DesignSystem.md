# Atlas Design System

The tokens in `app/globals.css` are the source of truth. This note describes the intent so it stays legible, not to lock it down.

## Foundation

- Palette: a near-monochrome neutral scale carries the UI and one Atlas emerald signals brand, primary action, focus, and the live state. Dark is the default theme; light ships behind `[data-theme="light"]`. Amber and red are reserved for real signals, never decoration.
- Type: Geist Sans for interface and reading, Geist Mono for figures, codes, and labels. Vendored in `assets/fonts`, decoded by the postinstall step, loaded in `app/layout.tsx`, and exposed as `--font-serif`, `--font-sans`, `--font-mono`.
- Scale: the root type size is 110% and every text and component size is rem-based, so the whole interface renders full without browser zoom. Hairline borders, radii, and icon glyphs stay in px so edges and marks remain crisp.
- Shape: one sharp radius scale, fixed. Controls 4px, rows and badges 6px, panels 8px, declared as theme tokens so the semantic utilities `rounded-control`, `rounded-row`, `rounded-panel` are the only radii components use. `rounded-full` is reserved for true circles such as avatars and dots. Fine borders over shadows.
- Motion: one easing curve, short transitions, reduced motion respected.

## Mark

A course aperture: measured top ticks, converging paths, and a single point of orientation, drawn in white on a very dark hunter green tile. The same asset is used for the sidebar mark, wordmark lockup, session surfaces, and browser icon. Asset at `public/brand/atlas-mark.svg`; rendered by `BrandMark` and `AtlasMark` in `components/atlas/primitives.tsx`.

The mark's geometry is fixed. Where Atlas appears as an icon among interface icons, use the single-shade copy: the exact same artwork rendered as a currentColor stencil, never a redesign (`public/brand/atlas-icon.svg`, rendered by `AtlasIcon`).

## Surfaces

The product does not paint decorative or implied-data backgrounds. Records carry the screen; identity stays in the mark, the type, and a restrained accent.

Containment is not the default hierarchy. Start with type, spacing, alignment, and hairline rules. Add a bordered panel only when an element is an independent interactive surface. Do not turn every section, metric, student, criterion, or status into a card.

Management surfaces are table-first when people need to compare, filter, or scan records. A roster is a table, not a card grid. Keep full names visible, give columns explicit labels, and let one row carry one record.

Configuration is read-first. Show the facts needed for the task, then put forms behind a clear Edit control. Rubrics are viewed as rubrics and changed through Atlas and Review; grading pages do not ask professors to rebalance point arithmetic inline.

## Interaction Posture

Show the record and direct controls. Do not assign work to the user, narrate their attention, or teach them an ordinary interface. Labels name the actual object or state: `Work`, `Modules`, `Announcements`, `Students`, `Due Jun 28`, `8 submitted`, `Live`, `Draft`.

- Use the direct underlying noun. An assignment is an assignment. A session is a session. A submission is a submission. A grade is a grade. A rubric is a rubric. Never replace a core record with an ornamental abstraction such as `journey`.
- A teacher should not need to infer what an object, status, or action means.
- Do not use dashboard language such as `Needs action`, `Next`, `To do`, `course health`, generic `insights`, or tutorial hints.
- A status is a fact, not decoration. Prefer quiet text and a small signal over repeated badge boxes. Reserve badges for exceptional states that must interrupt scanning.
- Name things what they are: course, work, module, announcement, grades. Doctrine words like `course record` belong to the docs; the interface says course.
- No explainer sentences on controls everyone knows. The action label should carry its meaning. Do not repeat the Review gate below every proposal button.
- Atlas is represented by the mark or a plain label, never sparkle or wand iconography.
- Give navigation and controls a visible, restrained signifier before hover. Hover and focus confirm an available action; they do not reveal that an otherwise identical surface is clickable.
- The student agent may guide a student within a professor-defined learning contract. This rule applies to the ordinary LMS interface, especially professor surfaces.

## Components

Shared primitives live in `components/atlas/`. Prefer extending them over adding one-off UI.
