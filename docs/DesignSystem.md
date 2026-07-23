# Atlas Design System

The tokens in `app/globals.css` are the source of truth. This note describes the intent so it stays legible, not to lock it down.

## Foundation

- Palette: a near-monochrome neutral scale carries the UI and one Atlas emerald signals brand, primary action, focus, and active streaming. Dark is the default theme; light ships behind `[data-theme="light"]`. Amber and red are reserved for real signals, never decoration.
- Type: Geist Sans for interface and reading. Geist Mono is reserved for codes, figures, and timestamps, never navigation sections, prose labels, or status copy. Both faces are vendored in `assets/fonts`, decoded by the postinstall step, loaded in `app/layout.tsx`, and exposed as `--font-serif`, `--font-sans`, `--font-mono`.
- Scale: the root type size is 110% and every text and component size is rem-based, so the whole interface renders full without browser zoom. Hairline borders, radii, and icon glyphs stay in px so edges and marks remain crisp.
- Shape: one sharp radius scale, fixed. Controls 4px, rows and badges 6px, panels 8px, declared as theme tokens so the semantic utilities `rounded-control`, `rounded-row`, and `rounded-panel` are the only radii components use. `rounded-full` is reserved for true circles such as avatars and dots. Fine borders over shadows.
- Motion: one easing curve, short transitions, reduced motion respected. Page-entry motion belongs to the professor and student overviews only. Operational tabs and record routes render immediately.

## Mark

A course aperture: measured top ticks, converging paths, and a single point of orientation, drawn in white on a very dark hunter green tile. The same full-size asset is used in the expanded and collapsed sidebar, session surfaces, and browser icon. Asset at `public/brand/atlas-mark.svg`; rendered by `BrandMark` and `AtlasMark` in `components/atlas/primitives.tsx`.

The institution is the primary licensed-product identity. In the expanded shell, keep the full-size Atlas mark on the left and place the organization name with a small `Atlas` label beneath it on the right, all inside the existing header height. Repeat the organization name beneath the signed-in person's name. Do not add `Powered by` copy.

The mark's geometry is fixed. Where Atlas appears as an icon among interface icons, use the single-shade copy: the exact same artwork rendered as a currentColor stencil, never a redesign.

Course names and codes in student navigation do not carry a book icon. The text already identifies the course. The open-book-with-check glyph is banned throughout the product; Syllabus uses a document symbol instead.

## Surfaces

The product does not paint decorative or implied-data backgrounds. Records carry the screen; identity stays in the mark, type, and a restrained accent.

Containment is not the default hierarchy. Start with type, spacing, alignment, and hairline rules. Add a bordered panel only when an element is an independent interactive surface. Do not turn every section, metric, student, criterion, or status into a card.

Give each hierarchy level one rule owner. Page sections use headings and vertical rhythm, while tables and record lists may own the dividers between comparable rows. Do not wrap a divided list or table in additional top and bottom rules, and do not place a section rule around content that already has its own separators.

Management surfaces are table-first when people need to compare, filter, or scan records. A roster, assignment list, gradebook, or course-material library is a table, not a card grid. Keep full names visible, give columns explicit labels, and let one row carry one record. Filters must use facts the records actually carry.

Creation starts from a visible page-header action. The form opens in a focused dialog and never sits permanently in the record list. Editing follows the same rule: show the record first, then open a deliberate edit surface. Do not place a large textbox panel above or below a management list.

Announcements read like a professional message archive: searchable rows, author, subject, message preview, exact timestamp, and a clickable full-message view. Module detail may use a compact previous/current/next switcher whose current-week control opens a complete clickable week menu on hover or click.

Course Setup is an operational course workspace, not a metadata form. Show course identity, offering facts, structure counts, a rendered syllabus, and a searchable material library. Material intake supports documents, PDFs, slide decks, assessments, media, links, Common Cartridge, and QTI packages through a focused action. Display processing state, source, access, size or pages, and update time as record facts.

Configuration is read-first. Rubrics are viewed as rubrics and changed through Atlas and Review; grading pages do not ask professors to rebalance point arithmetic inline.

Teacher Settings is the transparent course agent configuration. Show identity, teaching behavior, student disclosure, course rules, knowledge readiness, assignment contracts, fixed system boundaries, and version provenance. Atlas is the editor. Provider, model, endpoint, and credential configuration is Atlas-owned server infrastructure and is never rendered as a course-actor control.

A student AI assignment is an assignment workspace, not a generic chat page. It uses the same AI Elements conversation substrate as the professor agent, while the header and utility rail keep the assignment, submission draft, rubric, grade, timer, and submit action distinct. The agent initiates pedagogical moves naturally from the professor configuration and assignment contract; the client does not fake stage changes or inject hardcoded domain prompts.

## Interaction Posture

Show the record and direct controls. Do not assign tasks to the user, narrate their attention, or teach them an ordinary interface. Labels name the actual object or state: `Assignments`, `Modules`, `Announcements`, `Students`, `Due Jun 28`, `8 submitted`, `Draft`.

Ordinary behavior uses ordinary diction. Delete copy that announces, explains, or dramatizes what visible records and controls already show. Keep copy only for facts, constraints, consequences, actionable errors, and recovery.

- Use the direct underlying noun. An assignment is an assignment. A session is a session. A submission is a submission. A grade is a grade. A rubric is a rubric. Never replace a core record with an ornamental abstraction such as `journey`.
- A teacher should not need to infer what an object, status, or action means.
- Do not use dashboard language such as `Needs action`, `Next`, `To do`, `course health`, generic `insights`, or tutorial hints.
- A status is a fact, not decoration. Prefer quiet text and a small signal over repeated badge boxes.
- Published is the normal record state and stays unlabelled. Show `Draft`, `Review`, `Submitted`, `Missing`, and other states only when they change meaning.
- Plain actions such as `Publish` and `Sign out` are text-first and do not carry a redundant icon beside the label.
- Section headings do not carry decorative icons. Use an icon only when it communicates an action or state that text alone does not.
- Do not add row selection unless selected records have a clear available action.
- Learning-objective codes and coverage stay internal. Do not show objective chips, counts, coverage meters, or selection controls.
- Name things what they are: course, assignment, session, submission, grade, rubric, module, and announcement. Doctrine words belong to docs; the interface uses the record noun.
- No explainer sentences on controls everyone knows. The action label should carry its meaning.
- Atlas is represented by the mark or a plain label, never sparkle or wand iconography.
- Give navigation and controls a visible, restrained signifier before hover.
- The student agent may guide a student only inside the professor-defined course configuration and assignment contract.

## Components

Shared primitives live in `components/atlas/`. Prefer extending them over adding one-off UI.
