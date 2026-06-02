# Atlas — Design System

Built on **shadcn/ui** (Radix + Tailwind v4) with a warm, scholarly theme and the **Family Values** philosophy (Simplicity → Fluidity → Delight). The premise is reducing friction, so the interface must feel calm, fast, and unmistakably in the user's control. Tokens live in `app/globals.css`; the prototype `prototype/atlas-demo.html` mirrors them exactly.

## Why warm (not the generic default)
Most AI UI converges on Inter + violet gradients + flat instant state changes — lifeless slop. Atlas deliberately rejects that: a warm parchment canvas, a deep **pine** primary (scholarly, calm), and a sharp **marigold** accent reserved for the agent and for delight. It should feel like a beautifully made textbook that's quietly alive — not a SaaS template.

## Theme (shadcn tokens, warm "Quad")
- **Canvas** parchment `hsl(39 38% 95%)` · **card** `hsl(40 50% 98%)` · **ink** `hsl(28 18% 14%)`
- **Primary — deep pine** `hsl(158 39% 22%)`: structure and confirm/structural actions
- **Accent — marigold gold** `hsl(36 86% 49%)`: the *agent* layer + delight pops (sharp, used sparingly)
- **Clay / terracotta** `hsl(14 58% 49%)`: risk, at-risk, warnings
- **Destructive** `hsl(12 62% 47%)`; muted/secondary are warm sands; `--radius: 0.8rem`
- Dark mode tokens included. Two-color system: **pine = institution, gold = the living agent.**

## Typography (intentional pairing — no Inter)
- **Display:** Fraunces (optical serif, warm and characterful) — headlines + wordmark only
- **UI/body:** Hanken Grotesk (humanist grotesk, crisp, distinct from Inter)
- Mono: Geist Mono for labels/numerals; tabular-nums on all changing figures

## Components (shadcn/ui)
`components/ui/` holds real shadcn components (New York style) on the warm theme — `button` (with an added `gold` variant for AI actions), `card`, `badge` (`pine`/`gold`/`clay` variants). `lib/utils.ts` exports `cn`. Generate more with `npx shadcn@latest add sheet tabs dialog progress scroll-area command tooltip`. The prototype demonstrates the full set (sheets/trays, command palette, tabs-as-personas, progress rings) styled identically.

## Motion (Fluidity — "we fly instead of teleport")
- **Golden easing `cubic-bezier(0.16, 1, 0.3, 1)`** for every entrance/morph (`--ease-fluid`); `ease-in` for exits; never linear.
- Directional view transitions (forward → from right, back → from left). Persona/autonomy switches use a sliding glider, not a cut.
- The proposal bar **travels** in; the agent's plan arrives as staggered chips; tool spinners resolve to checks in place.
- Text-morph on the primary CTA ("Draft the course" → "Drafting…" → "Drafted ✓") — production uses `torph`; the prototype uses a shared-prefix crossfade.
- Persistent chrome never re-animates; only the changing region moves.

## Delight (selective emphasis — the Delight-Impact Curve)
- **Frequent = subtle:** count-up numbers (stat tiles, the readiness ring), chevron/nav micro-motion, button press.
- **Rare = theatrical:** approving a course publish fires a **confetti** celebration ("STAT-201 is live") — a once-per-course moment, not a checkmark.
- **Designed empty states:** the Course Builder empty state floats an illustration and points to the action — never bare text.
- **Easter egg:** click the Atlas mark → it spins and bursts confetti.
- All corners polished equally; success states are inline + animated (never toasts).

## Simplicity (gradual revelation)
- One primary action per view; everything else is secondary/ghost.
- Transient actions (publish, post grades, send nudges, start a session) are **trays** that overlay context with varying heights and a title + dismiss — never full-page jumps.
- Outputs are **draft by default**; the destructive/irreversible step always gets an explicit, counted confirm ("publish to 32 students").

## The taste checklist
Run `Design with Taste (Family Values)` before shipping any surface. No dirty bathrooms: the settings page gets the same care as the hero.
