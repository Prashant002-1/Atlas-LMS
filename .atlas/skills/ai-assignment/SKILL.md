---
name: ai-assignment
description: Create or revise an AI assignment contract and rubric from an existing assignment.
---

# AI assignment

1. Inspect the target assignment, current session contract, rubric, submissions, and class results needed for the request.
2. If the assignment is not configured, use draft_ai_assignment for one complete reviewable AI assignment: brief, duration, and rubric. The complete transcript is always available to the instructor, and personal-record side notes are always active.
3. Use update_session_contract for ordinary contract edits the professor asks to make directly.
4. Use draft_rubric for a rubric revision so versioning remains explicit and existing grades stay tied to the rubric that produced them.
5. Rubric criteria must be observable in the student's session. Describe what the student says, tests, revises, compares, calculates, or defends.
6. Use four levels: Exceeds, Meets, Developing, Missing. Weights are integers totaling 100. Missing is 0, and Exceeds equals the criterion weight.
7. Preserve criterion keys when revising the same criterion.
