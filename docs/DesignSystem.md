# Atlas — Design System

The product's premise is **reducing friction**, so the interface must feel calm, fast, and in control. Principles below are enforced in `prototype/atlas-demo.html` and are the spec for the React build.

## Principles (the anti-slop rules)
1. **Every component has a job.** No decorative filler. If a panel doesn't help the user decide or act, it's cut.
2. **Empty states teach the next action** (they always offer "Ask Atlas").
3. **The human is always in control.** Agent output is *draft* until approved; **Stop** is always visible while the agent works; high-stakes actions (publish, grade, send) require explicit confirmation; low-stakes ones don't (no approval fatigue).
4. **The agent is a distinct, calm layer** — never noisy. Reasoning is present but collapsed by default.
5. **Motion conveys causality, not flair** — 180–300ms, ease `cubic-bezier(.22,.61,.36,1)`; stream content in, count values up, transition views. Respect `prefers-reduced-motion` (real build).

## Information architecture — 3 columns
- **Left rail** — one role-aware nav with full LMS breadth, *identical structure across every course* (fixes the #1 complaint).
- **Center** — the content/artifact being read or built.
- **Right (Atlas)** — the always-present co-pilot: chat to steer, plan chips, tool cards, reasoning drawer, approval controls. Collapsible.
- **Top bar** — context breadcrumb, ⌘K (agent one keystroke away), always-visible agent status + Stop, persona switch.

## Tokens
**Type:** `Inter` for UI (400–700, ‑0.005em tracking); `Instrument Serif` for display/wordmark *only* (warmth without noise).
**Color:**
- Canvas `#FBFAF8` warm-white · surface `#FFFFFF` · ink `#16141B`
- **Institutional indigo** `#4F46E5` for LMS chrome/structure
- **Agent violet** `#7C5CFF` (+ tint `rgba(124,92,255,.07)`, dashed borders for *proposed* states) — so "Atlas thinking" always reads as its own layer
- Semantic: ok `#15A66A`, amber `#D08700`, red `#DC2626` — used sparingly, only to signal state
**Surface:** radius 9/13/18px; hairline borders `rgba(22,20,27,.09)`; soft shadows (1px + diffuse); generous padding — data-dense but breathing.

## Signature components
- **Plan chips** — dashed-violet, editable (×), appear before the agent acts.
- **Tool cards** — inline, with spinner → check; never raw logs.
- **Proposal bar** — sticky; tag flips `Draft · not created` → `Created · published`; shows a diff; Approve / Edit / Regenerate.
- **Coverage ring + objective bars** — readiness weighted by what's assessed; the gap is amber, not hidden.
- **Citations** — every tutor claim links to the source (slide/syllabus).
- **Autonomy slider** — Approve each → Auto + review → Run & summarize.

## States to never skip
Loading (skeleton, not blank) · streaming (token-by-token) · draft vs. live (unmistakable) · empty (teaches) · success (quiet, not confetti).
