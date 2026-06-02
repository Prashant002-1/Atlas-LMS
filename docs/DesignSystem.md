# Atlas — Design System

**Upscaled from the original Personal-Canvas / Kairos aesthetic — not reinvented.** The original was praised for being *quiet yet immersive*; Atlas keeps that exact register and refines it. Built on **shadcn/ui** (Radix + Tailwind v4), `neutral` base. The job is to reduce friction and stay out of the way — so the interface whispers.

## The register (what "quiet + immersive" means here)
- **Monochrome.** Black, white, and neutral grays. Near-zero decorative colour. Colour is *functional only*: a single restrained warning signal (`--warn`) and `destructive` red, used tiny. No brand gradients, no accent fills.
- **The dot-grid canvas.** The content area carries a faint dotted background (`radial-gradient`, 22px) — the signature that makes it feel like paper, not a dashboard. Carried over verbatim from the original.
- **Soft, translucent layering.** Cards are `bg-card` with hairline borders, soft radii (10–22px), and gentle shadows; many surfaces sit at `/70`–`/80` opacity over the grid.
- **Refined micro-labels.** Uppercase, letter-spaced (`0.14em`), in **Geist Mono** — for section labels, eyebrows, the agent's goal, autonomy. This is the original's `tracking-[0.18em]` signature, upscaled.
- **Generous whitespace.** Centered max-width canvas (~880px), calm rhythm.

## Anti-slop guardrails (lessons paid for)
Do **not** reach for the AI-default register: Inter, purple/violet, warm-cream "editorial," display serifs, confetti, easter-egg theatrics, rainbow badges. Those read as generated. Restraint is the brand.

## Typography
- **Geist** (sans) for everything; **Geist Mono** for labels, numerals, and IDs. Headlines `tracking-tight`, weight 600. No serif.

## Theme tokens (`app/globals.css`, shadcn `neutral`)
- bg `0 0% 100%` · foreground `240 10% 3.9%` · primary `240 5.9% 10%` (near-black) · muted-foreground `240 3.8% 46.1%` · border `240 5.9% 90%` · sidebar `240 4.8% 98%`.
- `--warn 35 92% 45%` and `--destructive` are the only non-neutral values; both used as small foreground signals, never fills.
- `--radius 0.625rem`; dark mode tokens included. Golden easing `--ease-fluid: cubic-bezier(0.16,1,0.3,1)`.

## Components (`components/ui/`)
Real shadcn — `button` (default/secondary/outline/ghost/destructive/link), `badge` (secondary/muted/outline/destructive), `card`, `lib/utils.ts` `cn`. Generate the rest with `npx shadcn@latest add sheet tabs dialog command progress scroll-area tooltip`. The prototype mirrors these tokens exactly.

## Motion (gentle, framer-grade — from the original)
- Entrances: `opacity` + `y:8`, ~0.25–0.4s, **golden easing**. Sheets spring up (`damping ~32, stiffness ~300`). Tabs/views slide directionally. Tool spinners resolve to checks in place; the proposal bar travels in.
- Persistent chrome never re-animates. No theatrics — restraint over flourish.

## Simplicity (gradual revelation)
One primary action per view; transient actions (publish, post grades, send nudges, start a session) are context-preserving **trays** with a title + dismiss; everything draft-by-default with an explicit, counted confirm.

## Reference
The prototype `prototype/atlas-demo.html` is the canonical visual spec. When in doubt, match the original repo's feel: quiet, paper-like, monochrome, immersive.
