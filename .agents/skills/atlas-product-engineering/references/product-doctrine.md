# Atlas Product And Interface Doctrine

## Product Compass

Atlas is an LMS rebuilt around teacher-governed AI. The agent is the interface, memory, and context layer, while the course record is the trusted substrate. The distinctive assessment is the session: the student works with the agent inside a professor-defined contract, the reasoning journey is evidence, and the professor remains the author and court of appeal.

Standard LMS capability still matters. Atlas must feel like a working academic system, not a chatbot, prototype, or collection of AI features. Courses, modules, assignments, announcements, calendars, grades, students, submissions, rubrics, and settings form the operational ground beneath the agent.

Use the current product sources in `docs/README.md`. In particular, consult `docs/Vision.md`, `docs/demo/script.md`, `docs/v0/implementation-plan.md`, `docs/Brand.md`, and `docs/DesignSystem.md` as relevant. Current code and artifacts beat stale prose.

## Start With Actors And Journeys

Reason from what a real instructor or student is trying to accomplish across a complete flow.

For instructors, preserve direct access to the real work of teaching: courses, modules, assignments, announcements, students, submissions, grades, course setup, review, and planning with Atlas. The professor decides priority. Atlas provides facts, controls, and context.

For students, make the LMS complete enough to be credible: courses, calendar, modules, assignments, grades, and governed work sessions. The student agent may guide within the professor's contract, but ordinary LMS surfaces should remain direct and understandable.

Do not call a set of 200 routes a product. A journey must connect navigation, record state, action, persistence, and the next natural destination.

## Keep The Interface Record First

- Name the actual thing: `Work`, `Modules`, `Announcements`, `Students`, `Assignment`, `Submission`, `Grade`, `Rubric`, `Draft`, `Missing`, `8 submitted`, `Due Jun 28`.
- Present facts without converting them into instructions or invented urgency.
- Do not use `Needs action`, `Next`, `To do`, `course health`, `active sessions`, generic `insights`, or digest language as dashboard structure.
- Do not expose doctrine terms, implementation details, agent plumbing, objective codes, coverage meters, raw schema names, or review mechanics in ordinary UI copy.
- Show a status only when it changes what the user can understand or do. Published is normal and usually needs no badge.
- Put direct controls near the record they operate on. Do not add a layer merely to explain another layer.
- Let forms support durable records and explicit edits. Do not let forms become a substitute for the agent-mediated flow or a permanently open panel above a record list.

The standard is not minimal surface area at any cost. It is minimal conceptual intervention with complete capability.

## Make The Product Feel Intentional

Atlas should feel calm, precise, scholarly, and quietly premium. Use `app/globals.css` as the token source of truth and shared components in `components/atlas/` before inventing local styling.

- Use the sharp radius scale: controls 4px, rows and badges 6px, panels 8px.
- Prefer type, spacing, alignment, and hairline rules over boxes. Use a panel only for a genuinely independent surface.
- Avoid card grids for management records, nested cards, repeated badges, oversized empty dashboards, decorative gradients, generic AI sparkle language, and ornamental status abstractions.
- Make interactive elements visibly actionable before hover with a restrained cue. Hover and focus confirm affordance; they do not reveal it for the first time.
- Use table-first layouts where users compare or scan records.
- Keep creation behind a clear page-header action and a focused dialog. Keep configuration read-first, then expose a deliberate Edit control.
- Use the fixed Atlas mark and existing identity. Do not create alternate marks or generic internet iconography.
- Add Atlas-specific illustration or art only when it gives an empty, completed, or transitional state useful personality. It must not compete with records or turn operational pages into decoration.

Visual hierarchy must answer what the page is, what records are here, and what direct actions exist without explanatory prose.

## Assume Competence In Copy

Use short, literal labels. Remove anxious reassurance, tutorial hints, implementation names, feature narration, demo language, and copy that tells users what competent professionals already know.

Do not write `Professor-controlled`, `AI-powered workflow`, `Your next action`, or similar explanatory labels when hierarchy and behavior can make the relationship obvious. The system may be professor-governed without saying so on every screen.

## Make Data Carry The Story

Demo and seed data must model the intended usage, not merely satisfy foreign keys.

- Make the professor's course feel active and credibly mid-semester through actual records and varied states.
- Seed open work, submitted work, graded history, missing work, live and draft modules, announcements, planning history, and student variation when the current demo requires them.
- Keep time-sensitive states coherent with the app's current clock or an explicit demo clock.
- Avoid duplicate latest records, contradictory empty states, and counts that drift from the fixture contract.
- Seed through the same code paths and data shapes the live product consumes when practical.
- Keep one source of truth. Do not maintain parallel demo-only interpretations of the same record.

More data is not the answer by itself. Use enough meaningful activity to prove a real working course, then keep the first screen legible.

## Reject These Failure Modes

- Generic AI wrapper or chat page presented as the product.
- Route completeness without actor-journey completeness.
- A professor dashboard acting as a task manager.
- Surface bloat created to expose implementation sophistication.
- A bland wall of boxes, buttons, and badges with no hierarchy.
- A decorative redesign that ignores record density and repeated use.
- Fake controls, placeholder claims, or unimplemented actions presented as working product.
- A polished UI resting on non-persistent data or an incoherent seed world.
- Historical command, cue, or Eve prototypes revived after the current docs removed that direction.
