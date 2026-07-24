# Atlas - YC Demo Information Packet

**Status:** Direction locked. The scenario is a PLACEHOLDER (econ example - explicitly not final). Script draft v0.1 at the end.
**Date:** 2026-07-03
**Companion:** `docs/Vision.md` (rewritten same day). YC Fall 2026 official deadline: **July 27, 2026, 8pm PT**. Internal target: July 6. Interviews (10-min Zoom, live screenshare of the product) run Aug-Sept.

---

## 0. How to read this document

The reasoning is the payload. Every element of this demo exists for a reason, and the reasons are recorded next to the elements so that future edits do not accidentally delete the argument while polishing the surface. The script at the end is a draft *rendering* of the decisions above it. When the final scenario is chosen, rewrite the script; keep the reasons.

---

## 1. Why the pitch changed

**What Atlas was pitched as:** a Canvas competitor that reduces the clerical burden on teachers - modules, grading, course organization - "universities already pay instructional designers; we automate it."

**Why that pitch died** (research sweep, 2026-07-01):

1. **Content generation is the most commoditized image in edtech.** Every incumbent ships it. Canvas's own version (IgniteAI Agent, Rubric Generator, Discussion Insights) left the free bundle June 30, 2026, and faculty senates were voting it off campuses before that (WWU unanimous, Mar 2026; Rutgers paused, Feb 2026). You cannot build a company on the incumbent's checkbox feature.
2. **"We have a student side" is not a moat by existence.** Canvas's student-side promise (OpenAI "LLM-Enabled Assignments," announced July 2025 with instructor-visible transcripts) never shipped and went dark. But D2L Lumi Tutor, Google Gemini/NotebookLM for Classroom, Claude for Education, and Coursera Coach all ship student-facing AI. Differentiation must come from *what kind* of student AI, not *whether*.
3. **There is an unowned position.** AI currently sits either **beside** the course (ChatGPT: where learning actually happens, invisible to the teacher) or **inside the admin tool** (Canvas: clerical efficiency for instructors). Nobody owns AI **between** teacher and student - every interaction grounded in the course, shaped by the teacher's policy, visible as learning evidence. That position is the product.

**The thesis in five lines:**

1. The agent is a manifestation of the professor.
2. The assignment is the session; the journey is the deliverable.
3. When the journey is what gets graded, copying an answer earns nothing. No detection needed.
4. The governed agent is more useful than the open web's, because it knows the course, the student's record, and what is coming. Students choose it out of self-interest, not compliance.
5. The professor's attention scales without losing authorship.

---

## 2. The evidence the narrative stands on

Use these in the written application; the demo shows, it does not cite.

- **88%** of UK students used generative AI for assessments in 2025, up from 53% in 2024 (HEPI Student Generative AI Survey).
- UC Berkeley study of **500,000+ grades** across 319 courses: A-grades in writing/coding-heavy courses rose **13 points** post-ChatGPT, concentrated in *homework*, not exams (Chirikov, May 2026). The take-home artifact no longer carries signal.
- Grading a paper: 15-30 min. Adjudicating one suspected AI case: **4-8 hours** of unpaid work (Ars Technica, Apr 2026). Viral faculty line: "AI has forced me to turn into a punitive detective, rather than, well, a teacher" (Newsweek, Dec 2025).
- Only **32%** of institutions have any campus-wide AI policy; only **22%** of faculty call theirs effective (Tyton Partners, Time for Class 2026). Policy without enforcement is theater.
- Turnitin AI-flagged submissions: 3.3% (2023) to **14.8%** (early 2026). Detection is discredited (false-positive studies; Vanderbilt et al. disabled it). Princeton went to universal exam proctoring July 1, 2026. Blue books are back.
- The institutional answer is emerging without software: University of Sydney's **two-lane** framework (secured lane verifies learning in person; open lane scaffolds AI use) is now embedded in policy with every assessment mapped; the **AI Assessment Scale** (Perkins/Furze/Roe) declares permitted AI per assessment across hundreds of institutions. Paul Graham, June 2026: explicit per-work AI policy, expected or banned, "no mushy middle ground"; banned must be *prevented*.
- Grading the process is already practiced by hand: Mike Kentz's "grade the chats"; NYU Stern's AI-conducted oral exam at **$0.42/student** with grade reliability alpha = 0.86; U Toronto's All Day TA in ~100 universities at ~$1-2/student. Atlas makes a desperate manual workaround native.

---

## 3. YC constraints that shape the video

- **Founder video:** exactly 1 minute, founders talking, nothing else. No script (bullets, spontaneous), no demo footage, no music. This is where the ambition sentence lives - the "new framework for education" claim goes in the founder video's last line and the written app, **never in the demo**. Partners are allergic to "revolution" as a claim and defenseless against it as a screenshot.
- **Demo video:** separate field. Unpolished is explicitly fine ("The difference between nothing and something is huge" - YC's Stephanie Simon). No hard cap, but partners read ~100 applications a day: **assume only the first 60 seconds is guaranteed.** The structurally-different thing must land by 0:60.
- **Division of labor:** written app = the narrative (problem-first, with the Section 2 numbers). Founder video = who we are and why this problem owns us. Demo = product only, screen only.
- **The demo video gets the interview; the live product closes it.** Interviews are Aug-Sept, 10-minute Zoom, "have it loaded up and ready to screenshare." Whatever the video shows must actually run by August.

---

## 4. Demo craft decisions, with reasons

| Decision | Reason |
|---|---|
| One scenario, deep | 3 minutes. Depth is the differentiator; two shallow scenarios read as a feature tour. Exam-prep scenario cut (it looks like every AI study tool; its differentiated parts - performance-aware, teacher-governed - are already carried by the session scenario). |
| Screen only, no actors | YC anti-promo doctrine. The two-person story (professor and student) is delivered by the professor's voice reading her own posted assignment instructions over the student's screen. The camera never leaves the product. |
| The student surface is a work session, not a chatbot | Chat chrome is both commoditized and (founder conviction) an eyesore. Exam-room framing instead: assignment brief pinned, rubric one click away, "grounded in" chips, expected-time, Submit button, and a split view where the student's evolving artifact grows beside the conversation. The conversation is the medium; the screen shows work product. |
| No refusal/blocking beat | In a fully-AI-enabled session there is nothing to refuse; a blocked student reads as friction. Governance appears as *shaping*: grounded answers, questions asked back, rubric-aware guidance. (In an AI-banned assignment, governance looks different - but that is not this video.) |
| Creation shown as instrument authorship, not content generation | "AI creates course content" is the single most commoditized image in edtech. What we show being created is an *assessment instrument* (rubric + session config), drafted by the agent from syllabus + outcomes, **edited and approved by a human on camera**. The 10-second weight edit is the difference between "AI generated a rubric" and "the professor's rubric, drafted by her agent." |
| Side note as margin annotation card, not chat bubble | Structured context injection must look structurally different from model chatter. The visual difference IS the product claim. See Section 6. |
| Appeal as chip, not scene | "Request professor review - full transcript attached" communicates that the human is the court of appeal without staging a dispute (negative energy, 20 wasted seconds). |
| Feedback flash must quote the student's journey | "AI writes feedback" alone is IgniteAI territory. The differentiator: professor's rough dictation becomes a note in her register that cites the student's actual session. First cut if the video runs over. |
| Standard LMS workflows = 5-second montage | Completeness proof only ("the agent runs the boring parts too"). Never linger in the commoditized zone. |
| Instructions text on screen carries the soft lines | "The transcript is shared with me if I need it, but I'm not reading everything - feel comfortable thinking out loud" stays visible but un-narrated. Partners who pause get rewarded; the voiceover stays tight. |

---

## 5. The storyboard (v3), and why each beat is where it is

| Time | Beat | Why it is placed here |
|---|---|---|
| 0:00-0:30 | Student opens the new assignment; professor V.O. reads the ~70-word monologue | Problem + product in 10 seconds. "There's nowhere to cheat" must land by ~0:25 because a partner may stop at 0:60. The monologue does the work a narrator would otherwise do - problem statement in a teacher's voice ("more than 80% of you already use ChatGPT - I see the same answers" is the Berkeley study wearing a persona). |
| 0:30-0:45 | Agent opening guidance: "what doing well looks like," three bullets from the rubric | Rubric transparency as onboarding. Sets the success criteria *before* work starts, so the later scoring feels fair rather than ambush. Also quietly makes the pedagogy claim (students know what is being measured). |
| 0:45-1:35 | The session: interrogation, stress-test, **side-note card**, visible revision in the artifact panel, Submit | The side note sits mid-session deliberately: by then the viewer understands the format, so the card reads as context-layer magic rather than confusion. The stress-test -> revision sequence shows Iteration (the rubric's heart) happening live in the artifact diff. |
| 1:35-1:50 | Student's journey report: four criteria, evidence quotes, appeal chip | Instant payoff closes the student thread; introduces evidence-cited scoring 15 seconds before the professor's version of the same interface, so the review act needs zero explanation. |
| 1:50-2:20 | Rewind to the professor: rubric drafted -> weight edited -> approved; session config incl. the side-note toggle; her prior "Exam 2 planning" session visible in history | Mystery -> reveal ("everything the agent just did came from here"). Placed AFTER the student act so the viewer already cares what these controls do - and so the video does not open on the commoditized creation image. The visible prior planning session tells the provenance story (Section 6) without a word. |
| 2:20-2:50 | Professor after: 31 journey cards -> drill into one -> "what should Thursday cover?" -> class-level answer -> practice-set proposal -> approve. 10s feedback dictation flash | Order is individual -> aggregate -> loop: one card proves depth, the grid proves scale, the class-insight turn proves the loop closes back into teaching. This beat makes "I'm not reading everything" visual: the rubric read the transcripts, the professor spot-checks cited evidence. |
| 2:50-3:00 | 5s LMS montage line + close on the journey grid: "This isn't a submission. It's a session." | The montage proves completeness at minimum cost. The close names the new noun and stops. |

---

## 6. The side note: the context layer's money shot

**Form.** Not a chat bubble. A visually distinct, flagged, dismissible margin card:

> FLAG - **From your course record**: Elasticity cost you 8 of 12 points on Exam 1, and it anchors the practice set Prof. Osei is planning for Exam 2. This problem is built on it. Worth slowing down here.

Two sentences, structured, source-labeled. The visual difference is the claim: this is not the model freestyling; it is the context layer surfacing something it *knows* - gradebook, exam plan, and syllabus, joined. No general-purpose AI can render this card.

**Provenance (canon, per Prashant 2026-07-03).** The agent knows about Exam 2 because **the professor already planned Exam 2 with the agent** - she worked through the practice set and flagged topics in a prior session. There is no upload ceremony. *The professor's normal work with the agent IS the context ingestion.* Every hour she spends planning with the agent makes every student's session richer. This is a core product mechanic, not a demo trick, and the demo world must contain that prior planning session as a real artifact (visible in her session history during the setup act).

**Strategy.** This beat answers the hardest question in the thesis: *why would a student stay inside the governed environment instead of alt-tabbing to ChatGPT?* Because this agent knows Exam 2 exists and ChatGPT does not. It knows what the student got wrong in March and what the professor flagged for May. **The governed AI is not the restricted version; it is the more useful version.** Students choose the walled garden out of self-interest. Say that sentence in the written app.

**Rules.**
- Professor-sanctioned foreshadowing only ("Prof. has flagged this topic for Exam 2") - never exam leakage.
- Personal-record references are gated by a professor toggle in session config ("Personal-record side notes: ON"). The most magical moment in the demo is visibly permission-based - the whole doctrine in a checkbox.
- The student's own data flows TO the student. This inverts the surveillance fear: context serves the learner first.

---

## 7. Scenario selection (OPEN - econ is a placeholder)

**Prashant is not satisfied with the econ problem.** It stays in this packet as the worked example because it demonstrates the selection criteria well. The final choice must score on all six:

1. **One-sentence legibility** - a YC partner, a professor, and a parent all understand the problem by 0:08. No domain gate.
2. **Design-shaped, no single right answer** - so grading the journey is obviously the correct instrument, not a gimmick. (A calculus problem would make journey-grading feel forced.)
3. **A visible, evolving artifact** - something that grows in the split panel and can show a *diff* when the student revises under challenge.
4. **Context hooks on both sides of today** - a past weakness (prior exam) and a plannable future (next exam) so the side note has an honest source.
5. **"Same answers" resonance** - a homework genre where the professor's "I see the same answers" line rings true.
6. **Audience self-engagement** - ideally a problem YC partners involuntarily start solving themselves while watching.

**Worked example (placeholder):** Intermediate Microeconomics, "The Streaming Problem" - *VidStack, a streaming service, lost 18% of its subscribers after a flat $15 price hike. Design a new pricing structure and defend it.* Hits all six: universally legible; tiers/ads/annual plans are genuinely open-ended; the artifact is a pricing table + rationale; elasticity (Exam 1 weakness) and price discrimination (Exam 2 topic) are the hooks; econ problem sets are ChatGPT-homogeneous; YC partners price products for a living.

**Alternates considered:** research methods "design a study to test whether X causes Y" (intellectually the purest journey assignment - confound-hunting is all reasoning - but slower to parse on screen); CS systems design (partner-native but jargon-gates the non-technical reader). Whatever wins: it needs a believable past, a plannable future, and a deliverable someone can watch evolve.

---

## 8. The rubric framework (the actual product moment)

The demo's deepest claim is not the chat - it is the redefinition of what gets measured. The framework, general form:

- The agent **drafts** the rubric from the syllabus and learning outcomes; the professor **edits and approves**. Weights are the professor's pedagogy made explicit - some professors weight recovery, some weight engagement with materials, this one cares how you respond to being wrong.
- Criteria are **journey-facing**, not artifact-only. The artifact still counts; it is just not the only thing that counts.
- Every score **cites evidence** - quoted excerpts from the session. Scores without receipts are just vibes; receipts are what make "the rubric read it, the professor spot-checks" trustworthy.
- Scoring levels: Exceeds / Meets / Developing / Missing (teacher-configurable).

**Demo instance (placeholder scenario):**

| Criterion | Weight | What the agent looks for |
|---|---|---|
| Problem framing & questions | 25% -> *20%* | Interrogated the scenario before proposing: segments, churn cause, willingness to pay |
| Course-concept grounding | 25% | Elasticity, price discrimination, consumer surplus used correctly (Weeks 4-6) |
| Iteration under challenge | 25% -> *30%* | When the design is stress-tested, revises rather than defends |
| Final design & defense | 25% | A coherent pricing structure plus a rationale in the student's own words |

The italic edits happen **on camera** - the professor bumps Iteration, trims Framing, approves. Human authorship, proven in ten seconds.

---

## 9. The demo world (build requirement)

The demo world needs a **memory**, not just seeded courses. The side-note beat is only honest if the past actually exists in the system:

- [ ] Course profile + syllabus + Weeks 1-6 materials (final scenario's discipline)
- [ ] Exam 1 gradebook with a real distribution; featured student has the specific, named weakness
- [ ] **The professor's prior planning session with the agent** (Exam 2 / practice set discussion, topics flagged) - this is the side note's source and appears in her session history on camera
- [ ] ~31 students with varied journey outcomes (the review-grid needs believable spread: some Exceeds, some Developing, one or two "delegated everything and it earned nothing")
- [ ] Professor persona with a stated intent ("they pattern-match formulas; I want to see if they can reason about X")
- [ ] The assignment itself, configured: rubric, duration, grounding scope, and sanctioned side-note triggers

This is a content-design task as much as a build task. Do it before the UI - it is the difference between a demo and a diorama.

---

## 10. Anticipated questions (interview ammo)

- **"Can't the student just tell the AI to do the whole thing?"** - "Yes. And it earns them nothing - the rubric doesn't grade the answer's existence, it grades the thinking. We didn't restrict the AI; we made delegation worthless."
- **"Who reads 150 transcripts?"** - Nobody. The rubric reads them; the professor spot-checks the cited evidence; the full transcript is one click deep for audit and appeals.
- **"Why won't students just use ChatGPT?"** - ChatGPT doesn't know their course, their record, or what's on Exam 2. The governed agent is the more useful one. (Section 6.)
- **"Where did the agent learn about Exam 2?"** - From the professor. She planned it with the agent last week. The professor's normal work is the ingestion.
- **"Won't Canvas build this?"** - Canvas's AI is instructor-admin efficiency on a system of record; their student-side promise died in pilot; they are PE-owned, paywalling, and faculty senates are disabling their AI. Our buyer is the professor; our unit is the session; adoption starts with one course, not a procurement cycle.
- **"Privacy?"** - The session IS the submission; reviewing it is reviewing the work, same as reading an essay draft. Open studying surfaces aggregated signals only. Personal-record side notes go to the student they are about, and only if the professor enabled them.

---

## 11. Open questions

1. **Final course/problem** (econ = placeholder; apply Section 7 criteria).
2. **Name of the assignment type.** Candidates: "Session" (clean; gives the close: "This isn't a submission. It's a session.") vs "Tutorial" (the oldest teaching format - one tutor, one student, reasoning together - which is literally the back-to-primitives origin story: "Canvas has quizzes and file uploads. Atlas has tutorials."). Decide before UI copy is written.
3. **Keep or cut the feedback-dictation flash** (first cut if over 3:00; it lives fine in the written app).
4. **Final monologue wording** (~70-word budget; current draft in Section 12).
5. **Whether a 3-5s second-course glimpse is worth the generality proof** (probably not; depth wins).

---

## 12. Script draft v0.1 (PLACEHOLDER SCENARIO - rewrite when the course is chosen)

Narration budget: ~420 words total. Professor V.O. lines are diegetic (her posted text); NARRATOR lines are the founder's voice. Record real product; jump-cut typing; no music.

**[0:00-0:30 - The assignment]**
SCREEN: Student dashboard -> opens "Assignment 4: The Streaming Problem." Instructions fill the frame. Un-narrated soft line visible in the text: "The transcript is shared with me if I need it, but I'm not reading everything. Feel comfortable thinking out loud. - Prof. Osei"
PROF V.O.: "This week I don't care about the right answer. I care about what getting to it looks like. More than 80% of you already use ChatGPT - I see the same answers. So this time, the assignment IS the chat. There's nowhere to cheat. It's grounded in our course, and my rubric grades your thinking: your questions, your follow-ups, your final design. Take about thirty minutes. Submit when you're ready."

**[0:30-0:45 - What doing well looks like]**
SCREEN: Session opens. Exam-room chrome: brief pinned top, rubric chip, "Grounded in: Syllabus - Weeks 4-6," empty artifact panel right, Submit button.
AGENT (on screen): "Before we start, here's what doing well looks like in this session, from Prof. Osei's rubric: (1) Interrogate the problem before you propose - who are VidStack's customers, and why did they leave? (2) Use the tools from Weeks 4-6 - elasticity, price discrimination - and use them correctly. (3) When I push on your design, revise it rather than defend it. Ready when you are."
NARRATOR: "The rules aren't hidden in a syllabus PDF. The session states them up front."

**[0:45-1:35 - The session]**
STUDENT: "ok so they raised prices and people left. should they just lower it back?"
AGENT: "That's one lever - but before pricing anything: who left? A flat $15 hits a casual viewer and a four-hours-a-day household the same way. From Week 5: which group has the more elastic demand, and what does that tell you about a single price?"
SCREEN: **Side-note card slides into the margin**: "FLAG - From your course record: Elasticity cost you 8 of 12 points on Exam 1, and it anchors the practice set Prof. Osei is planning for Exam 2. This problem is built on it. Worth slowing down here."
NARRATOR: "The agent isn't a chatbot with a syllabus pasted in. It knows this student's record - and what this professor is planning - because she planned it here."
STUDENT: "casual viewers are more elastic... so one price overcharges them and undercharges heavy users. tiers? cheap ad-supported for casuals, premium for heavy users?"
AGENT: "Now you're doing price discrimination - Week 6. Sketch it: what are your tiers, and what is each group's willingness to pay based on?"
SCREEN: Artifact panel fills: Basic w/ ads $7.99 / Standard $12.99 / Premium $17.99 + rationale stub.
AGENT: "Your own segmentation says heavy users paid $15 without churning - Premium may be under their willingness to pay. Harder question: what stops a Standard subscriber from dropping to Basic? Who switches, and what happens to revenue?"
STUDENT: "...make Basic annoying enough - ads, one screen - so it only attracts people who would've churned anyway. Raise Premium to $19.99 with 4K and offline as the fence."
SCREEN: Artifact diff highlights the revision. Student clicks **Submit**.

**[1:35-1:50 - The journey report]**
SCREEN: Student's report: four criteria with level chips and one quoted evidence line each - Framing: Meets. Grounding: Meets ("correctly linked churn asymmetry to elasticity after review"). Iteration: **Exceeds** ("redesigned Basic as a churn fence when cannibalization was raised"). Design: Meets. Chip: "Request professor review - full transcript attached."
NARRATOR: "The submission is the journey. Scored against her rubric, every score with a receipt - and the professor is the court of appeal."

**[1:50-2:20 - Where it all came from]**
SCREEN: Professor's side. Session history shows a prior conversation: "Exam 2 practice set planning - Tue." Then the assignment setup: rubric card drafted from syllabus + outcomes; she edits Iteration 25 -> 30, Framing 25 -> 20; **Approve**. Config: Grounding: course materials - Duration ~30m - Personal-record side notes: **ON**.
NARRATOR: "Everything the agent just did came from here. It drafted the rubric from her syllabus and outcomes - she reweighted it, because what she cares about is how students respond to being wrong. Even the side note exists because she allowed it. Nothing went live without her sign-off."

**[2:20-2:50 - The class]**
SCREEN: 31 journey cards, sortable by criterion. Drill into one. Then she asks: "What should Thursday's session focus on?" Agent: "14 of 31 sessions show elasticity still confused with slope; the strongest recoveries followed the cannibalization push. Draft practice set attached - three problems, ten minutes, mirrors the Exam 2 coverage." **Approve.**
SCREEN (flash, ~8s): She dictates: "good recovery on cannibalization - elasticity still shaky, point them at the week 4 set." Agent drafts a note quoting the student's own exchange. Send.
NARRATOR: "She's not reading forty transcripts. The rubric already did - she spot-checks the evidence. And for the first time, she can see the class think - and teach to it."

**[2:50-3:00 - Close]**
SCREEN (5s montage): modules, materials, gradebook, calendar.
NARRATOR: "And yes - the agent runs the boring parts too. But that's not the point. This isn't a submission. It's a session. The professor defines it, students think inside it - and the learning is finally visible."
SCREEN: Journey grid. Atlas mark. End.
