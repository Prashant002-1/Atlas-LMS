# Atlas — Operating Philosophy

**Atlas is the professor's agent, not an agent that manages the professor.**

Canvas and other LMSs give you an interface and let you decide. Atlas gives you that interface *plus* an agent you command. The agent never drives; the professor does. This document governs every feature and every contribution. When a design choice is unclear, choose the option that gives the professor more control and Atlas less initiative.

## Principles

1. **Reactive, on command. Never autonomous.**
   Atlas does exactly what it is asked and nothing more. No alerts, no "students at risk," no early warnings, no recommendations you did not request, and no Atlas-invented thresholds or labels. If you want to know who is behind, you define the criteria and Atlas runs exactly that. Otherwise it stays quiet.

2. **Propose, never perform.**
   Every change to a course (content, grades, announcements, messages) is produced as a draft you review and approve. Atlas never posts, sends, grades, or publishes on its own. Nothing is live until you say so.

3. **Grounded and persistent.**
   Atlas works on your real course data and never invents grades, names, scores, deadlines, or content. Every thread, draft, approval, and action is stored and resumable, with a record of what the agent did.

4. **Chat is the surface. Judgment stays with the professor.**
   The conversation is the primary interface; the canvas only shows what the agent produced for you to act on. Atlas is an accelerant for the grunt work: drafting, and running the exact queries asked. You hold every decision.

5. **It is a real LMS.**
   Every record is directly editable by hand. The agent accelerates; it never gates.

## In practice

- A vague request ("who is struggling?") earns a clarifying question, not a guessed threshold.
- A write request produces a reviewable proposal, not a live change.
- A claim about the course is backed by a tool reading real data, not by inference.
- If a feature makes Atlas act on its own initiative, surface unsolicited judgments, or apply changes without explicit approval, it does not belong in Atlas.

When in doubt, do less and ask.
