# Atlas LMS — Vision & Thesis

## One-liner
Atlas is an LMS where course intent is the source of truth. Objectives, materials, assignments, submissions, study activity, and evidence live in one course record, so professors can shape a course with confidence and students can study what actually matters.

---

## The problem

Learning management systems were built around storage and submission, not intent. Two costs are hiding in plain sight:

### 1. Course creation is so hard that universities pay people to do it
Nearly every institution staffs an **instructional-design (ID) center** — specialists who help faculty turn their expertise into Canvas modules, syllabi, aligned assessments, and accessible content. This is a structural tax: the tool is so unfriendly that operating it is a job. Professors still lose **days to weeks per course** on mechanics — building module trees, formatting syllabi, wiring assignment groups, copying last term's course forward.

### 2. Learning has already left the building
Students study across notes, slides, readings, group chats, and outside tools while the LMS stays disconnected from the syllabus. A student can study for hours and still not know whether they covered what the professor will actually assess. Exams become surprises, and the course record does not explain why.

The incumbents cannot fix this by adding a button. Their data model has no durable concept of _intent_ - what the course is for. You cannot ground teaching, studying, assessment, or evidence in objectives that were never modeled.

---

## The Atlas thesis

Rebuild the LMS around a new primitive: the **Alignment Graph**.

- **Learning objectives** are first-class (course- and module-level), optionally mapped to **program/accreditation outcomes**.
- **Every artifact** — module, assignment, quiz, page, reading — is tagged to the objectives it serves.
- **Every student action** - a submission, practice response, study session, or coverage check - can be measured against those objectives.

Once intent is modeled, Atlas becomes useful on both sides:

**For professors**
> "Create a 14-week Intro to Statistics course aligned to these five outcomes, ABET-style, with weekly modules, two midterms, and a project."

Atlas can draft the syllabus, module tree, assignments, and rubrics as a change proposal the professor reviews and approves. The professor sees the course record, coverage, and gaps directly. Nothing is live until it is accepted.

**For students**
Atlas turns the same record into a study path: what matters now, which material supports it, what work is open, where the student has evidence, and what is still weak. No guessing from scattered course material.

---

## Wedge (how we get the first 100 users)

**One-course import.** We do not ask a university to rip out Canvas. We let one professor import one course, cleanly expose the structure, align it to objectives, and make the course teachable from a better record. Bottom-up adoption starts with one useful course.

## Moat (why this compounds)

1. **The Alignment Graph** - structure incumbents cannot retrofit cheaply. It grows richer with every course authored, taught, studied, and assessed.
2. **Reviewable course changes** - drafts, approvals, dismissals, and published records make change safe without hiding the record behind automation.
3. **Two-sided course evidence** - professor intent -> student work -> outcomes -> better course design. Each course taught makes the next one clearer.

## Why now

- Models are finally good enough to help draft, align, and explain from source material when the product gives them a real course record.
- Students already study outside the LMS; the behavior change happened, but the course record did not come with them.
- Institutions are actively paying for the pain (ID centers, accreditation consultants), so budget exists today.
- Incumbents are architecturally frozen around files, modules, and submissions instead of course intent.

---

## Beyond the core: adjacent pain we can take

These are not v1, but they show the surface area once the course record is structured correctly:

- **Accreditation & outcomes reporting** — ABET/regional-accreditor evidence is months of manual work; Atlas emits it from the Alignment Graph automatically. Institutional budget unlock.
- **Grading load** — rubric-grounded grading support with professor approval.
- **Grounded TA** — answers student questions from actual course material with citations and escalation paths.
- **Academic integrity, reframed** — make outside help visible, constrained, and auditable instead of pretending it does not exist.
- **Accessibility & compliance** — ADA/WCAG checks at authoring time, not retrofitted under legal pressure.
- **Advisor support** — explicit institution-defined criteria can surface students who need attention before the midterm.
- **Course freshness** — detect dead links and stale content during term rollover.

---

## The pitch in one breath
Canvas made the course a collection of files, modules, and submission boxes. Atlas makes the course a record of intent, work, evidence, and study, so professors and students can act from the same source of truth.
