# Atlas — LMS Feature Parity & AI Leapfrog Map

Atlas must read as a *real* LMS, not a toy. This maps the feature surface of Canvas, Blackboard, Moodle, and D2L Brightspace, marks each area **[Table-stakes]** (must exist to be credible) vs **[Differentiated]** (where AI-native design leapfrogs), and states Atlas's take. The YC demo shows full nav breadth (so it reads complete) and goes *deep* on the differentiated flows.

> Legend: ✅ shown in the demo · ◻️ in the data model / nav, not yet deep · ⬚ post-demo build

---

## 1. Course setup & content authoring
| Capability | Parity | Atlas |
|---|---|---|
| Modules, pages, files, syllabus, rich content | Table-stakes | ◻️ in schema/nav |
| Course copy / Common Cartridge / QTI import | Table-stakes | ⬚ (Canvas import is the GTM wedge) |
| Blueprint / master courses, conditional release (Mastery Paths, Release Conditions) | Differentiated | ⬚ |
| **Generate a full course (objectives → modules → assessments) from a prompt or syllabus PDF** | Differentiated | ✅ **hero** — Course Builder, as a reviewable change proposal |
| Accessibility at authoring time (alt text, captions, reading level — cf. Ally) | Differentiated | ⬚ (planned: enforce on author) |

## 2. Assignments & assessment
| Capability | Parity | Atlas |
|---|---|---|
| Assignment types, online submission, group assignments | Table-stakes | ◻️ |
| Quizzes + question/item banks, 15+ item types | Table-stakes | ◻️ |
| Rubrics attached to any assignment | Table-stakes | ◻️ (rubric in grading demo) |
| SpeedGrader-style inline grading + annotation | Table-stakes | ✅ grading surface |
| Peer review / workshop | Table-stakes | ⬚ |
| Originality (Turnitin/SafeAssign), proctoring (Respondus/Honorlock) | Table-stakes | ⬚ (LTI) |
| **AI drafts rubric-aligned feedback + scores; instructor approves** | Differentiated | ✅ **hero** — draft-not-posted |
| Differentiated assignments (per-student dates/availability) | Differentiated | ⬚ |

## 3. Gradebook
| Capability | Parity | Atlas |
|---|---|---|
| Weighted assignment groups, grading schemes | Table-stakes | ◻️ (`assignment_groups.group_weight`) |
| Late / missing / posting policies (manual vs auto post) | Table-stakes | ◻️ |
| Grade history / audit, SIS passback | Table-stakes | ⬚ |
| Learning Mastery gradebook (outcome-level) | Differentiated | ✅ via Alignment Graph |
| **Anomaly / trajectory detection + suggested intervention** | Differentiated | ✅ early-warning card |

## 4. Communication
| Announcements, Inbox/messaging, threaded discussions, notification prefs | Table-stakes | ◻️ in nav |
| **Notification triage — "3 things need your attention," not a firehose** | Differentiated | ✅ Today view |
| Media/audio feedback | Table-stakes | ⬚ |

## 5. Calendar & scheduling
| Auto-populated due dates, cross-course calendar, availability/lock dates | Table-stakes | ◻️ |
| Scheduler / appointment groups (office hours) | Differentiated | ⬚ |
| **AI pacing — regenerate a schedule, shift all dates a term forward** | Differentiated | ⬚ (roll-forward) |

## 6. People & roles
| Roles (student/TA/instructor/designer/observer), custom permissions | Table-stakes | ✅ `role` enum + `enrollments` |
| Sections, student groups, cross-listing | Table-stakes | ◻️ |
| Observer/parent role, SIS-driven enrollment | Differentiated | ⬚ |
| **Multi-tenant orgs (institution isolation)** | Table-stakes (for SaaS) | ✅ `org_id` everywhere |

## 7. Outcomes, standards & accreditation
| Learning outcomes, align to rubric criteria, mastery thresholds | Table-stakes | ✅ `learning_objectives` |
| **Program/accreditation outcomes + auto-mapping + evidence export (ABET/regional)** | Differentiated | ✅ Alignment Graph (`program_outcomes`, `objective_outcome_map`, `content_alignments`) |

## 8. Analytics & insights
| Per-student engagement, grade distribution, course analytics | Table-stakes | ◻️ |
| Early-warning / at-risk (Retention Center, predictive indicators) | Differentiated | ✅ plain-language early-warning |
| Raw event pipeline to BI (Canvas Data 2) | Differentiated | ⬚ |
| **Cohort objective-coverage ("the class is weak on LO4 before the midterm")** | Differentiated | ✅ class insights |

## 9. Interoperability & admin
| LTI 1.3 Advantage, REST API, SIS (OneRoster), SSO (SAML/OIDC) | Table-stakes | ⬚ (Auth.js → SAML/LTI planned) |
| WCAG 2.1 AA, mobile apps, SCORM/xAPI | Table-stakes | ⬚ |

---

## The 10 friction points Atlas attacks (sourced from CU-Boulder 2024 survey, WPU Ultra study, Canvas community)
1. **Inconsistent navigation across instructors** → one consistent, role-aware shell. ✅
2. **Slow, context-switch-heavy grading** → AI drafts feedback; approve in one place. ✅
3. **Notification overload** → triaged "what matters today." ✅
4. New Quizzes regressions → modern assessment engine. ⬚
5. Clunky late/missing handling → policy + per-student exceptions. ⬚
6. Shallow analytics or expensive BI add-ons → AI early-warning built in. ✅
7. **Slow course setup / manual date-shifting** → generate + roll-forward. ✅ (generate) / ⬚ (roll-forward)
8. Confusing Ultra navigation → see #1. ✅
9. Dated Moodle UX → premium, modern UI. ✅
10. No portable learner record → outcome mastery travels with the student. ⬚

**Thesis:** match table-stakes so we're credible; win on the differentiated column, all of which require a data model that knows *intent* (the Alignment Graph) — which incumbents cannot retrofit.
