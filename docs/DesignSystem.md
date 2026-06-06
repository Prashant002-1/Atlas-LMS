# Atlas Design System

Atlas should feel like a quiet academic command center: dense enough for real work, restrained enough to earn trust, and confident enough not to narrate itself. The interface should never look like a generic AI wrapper.

The brand layer is a quiet generative field: sparse data points, course-map traces, small pixel clusters, and fine alignment marks. It should calm the surface when noticed and disappear when the user is working.

## Product Principles

- Assume competence: users should understand the view from structure, labels, and state, not from anxious explanation.
- Quiet control: course edits move through review states naturally; do not repeat trust language in visible UI.
- Grounded: claims point back to course material, objectives, assignments, or submissions.
- Real LMS: records must look directly editable; the agent accelerates but does not gate the workflow.
- Lean rigor: prefer one clear path over duplicate buttons, speculative states, or fallback-heavy flows.
- Low ceremony: avoid badges, sparkles, decorative gradients, mascot language, inflated AI claims, and implementation details.
- Atmosphere behind the work: art and motion may support focus, but they must never compete with course records, forms, or decisions.

## Visual Direction

- Palette: cool neutral workspace background, white work surfaces, charcoal text, muted metadata, one restrained teal accent for active state and progress, muted green for confirmed state.
- Typography: UI chrome uses a readable system sans; large product statements may use the `atlas-serif` utility for academic/editorial weight.
- Radius: panels, controls, and cards use 8px or less.
- Borders over shadows: use fine borders and small shadows only for work surfaces that need hierarchy.
- Density: product screens should fit useful course state above the fold; avoid oversized marketing cards, repeated boxes, and visible features that do not support the current task.
- Hierarchy: course records come first, review states stay visible, and command surfaces stay secondary until the user needs them.
- Generative field: use `public/brand/atlas-field.png` as a low-opacity background layer only. It should never carry content, reduce contrast, or become a hero image.
- Pixel glyphs: Atlas-owned micro-glyphs can represent practice bases, course maps, and alignment. Use them as quiet identity marks, not decorative stickers.
- Motion: background drift is slow and subtle; control transitions stay 150-250ms. Reduced-motion mode must remove atmospheric movement.

## Components

- `BrandMark`: app identity and route back to overview.
- `CodeList`: quiet inline objective-code metadata.
- `PracticeBaseStrip` / `PracticeBasePanel`: professor-provided dataset/problem-frame surfaces for generated practice.
- `ButtonLink`: primary, secondary, and ghost link buttons with icon affordance.
- `Panel`: repeated work surface with optional compact header.
- `StatusBadge`: neutral, accent, good, and warning state labels.
- `ProgressBar`: objective coverage and course progress.
- `ObjectiveMeter`: shared objective state with coverage, weight, Bloom level, and evidence.
- `RecordFact`: compact label/value rows for record metadata and study paths.
- `EmptyRecord`: low-ceremony empty states inside record surfaces.
- `Metric`: compact KPI summary.
- `ProductShell`: authenticated frame for course record routes.

## Route Contract

- `/`: overview and product preview.
- `/sign-in`: access route with role entry points.
- `/sign-up`: one-course start surface.
- `/teach`: teaching view.
- `/student`: study view with focus, grounded practice, work, material, and objective coverage.

New visible links must point to implemented routes. If a workflow is not real yet, route to the closest working surface and make the limitation obvious in code, not by leaving a dead link.

## Brand Handoff

Use `docs/Brand.md` for brand profile, atmosphere, copy rules, identity constraints, and the practice-base primitive. The next brand pass should refine the identity system without adding product chrome or explanatory UI.
