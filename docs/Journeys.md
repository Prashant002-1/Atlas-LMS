# Atlas Journeys

Atlas is a course workspace. After sign-in, each actor should land inside the course with a clear path through the work.

## Instructor

The instructor opens the course to answer four questions:

1. What needs attention today?
2. Which drafted changes are ready to apply or dismiss?
3. What should Atlas handle next?
4. Which drafts are ready to publish?
5. How is student work moving through the course?
6. Does the course map cover the intended objectives?

The route order is `Today`, `Review`, `Publish`, `Students`, `Map`.

Primary workflow:

1. Review the current course state.
2. Grade submitted work when it is waiting.
3. Apply or dismiss the top drafted change.
4. Ask Atlas for practice from a sample, dataset, or course context.
5. Ask Atlas to post a course note when the class needs direction.
6. See the persisted proposal in Today and Review.
7. Adjust generated material or work inside Review when needed.
8. Make reviewed material, work, or note drafts live from Review.
9. Land on the created work or material record after Review applies it.
10. Open week or work records only when content needs direct inspection.
11. Publish manual draft weeks or work from the queue or record.
12. Check submitted, graded, open, and missing work.
13. Mark open work missing from the work record.
14. Open a student record from the roster.
15. Open a work record when submissions need inspection.
16. Record grades from the work record.
17. Student standing updates from graded work.
18. Check coverage against assessed weight.

## Student

The student opens the course to answer four questions:

1. What should I do now?
2. What objective am I practicing?
3. Which material supports this work?
4. What changed in the course?
5. What is open, submitted, or done?

The route order is `Today`, `Practice`, `Material`, `Work`, `Grade`.

Primary workflow:

1. Start from the current objective and next action.
2. Ask Atlas for the next study package when the path needs shaping.
3. Get a compact package with review, practice, work, and check steps.
4. See recent study requests stay with the course.
5. Read the attached material.
6. Practice against a concrete shift from the attached base.
7. Continue from material into the aligned work.
8. Keep the linked material visible while writing work.
9. Submit the response from Work.
10. Use the same Work path to recover missing work.
11. See submitted work move into a waiting state.
12. Revise from the work record only when needed.
13. Check the grade in the work record.
14. Check coverage and standing.

## UI Rules

- Journey navigation names work areas, not implementation modes.
- Today shows the next action as a path into the right record or work area.
- Submitted work takes priority over review, publishing, and coverage prompts.
- Student Today chooses missing or open work first, submitted work second, and focus alignment only within the same state.
- Practice exposes the base, a few concrete shifts, and paths into material and work.
- Atlas is the primary instructor authoring path: one request becomes one persisted proposal.
- Atlas shows recent persisted proposals beside the command box.
- Professor-provided samples become ordinary material and work records after review.
- Explicit `Base:` and `Shifts:` requests persist into ordinary material and work records.
- Student practice reads persisted course material before using fallback examples.
- Course notes use the same review path and become ordinary announcement records.
- Student Today shows the latest course note without adding a separate work area.
- Student packages read from published course records before using fallback examples.
- Review owns light edits to generated material and work before anything goes live.
- Review can make generated material and work records live in one action.
- Applied review decisions keep links to the records they created.
- Instructor Atlas lives in Today: one request becomes one persisted proposal.
- Student Atlas lives in Today: one request persists to the active course record.
- Student Atlas returns a package immediately instead of sending the student to another setup flow.
- Package context follows the matching material or work record.
- Recent study requests are context, not a separate work area.
- Direct record forms are fallback controls, not the main workflow.
- Forms remain useful when the user is writing durable record data.
- Primary actions stay in the main column.
- Common Atlas requests become reviewable material or work drafts.
- Atlas stores free-form requests even when structured parsing is incomplete.
- Record edits stay with the record being inspected.
- Record pages start with a clear return link to the parent journey area.
- Alignment changes stay with the week or work record.
- Teaching work records keep linked material above submissions and grading.
- Publish shows the next draft first; the rest of the queue stays secondary.
- Publish can move the whole ready queue live at once.
- Student progress leads with work status; roster detail stays secondary.
- Student dashboards link into focused work records instead of showing submission forms inline.
- Student dashboards do not preview written responses; work records own reading and revision.
- Material records show the practice move and primary work path in the main column.
- Work records keep linked material above the response path.
- Submitted student work is waiting, not open.
- Missing work is recorded from the work record and clears when the student submits.
- Work records show the submitted response before grading controls.
- Student work records show the saved response before revision controls.
- Open and missing work does not show grading controls.
- Grading updates the student's course standing.
- The side rail gives context only.
- State is shown through the course record itself.
- Do not explain agent mechanics, provider details, or internal trust boundaries in the UI.
