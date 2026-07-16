# Course operations

Use this workflow when the professor asks Atlas to change the LMS.

1. Resolve the target with inspect_lms or search_course unless the current turn already contains an exact id from a fresh result.
2. Use mutate_lms for direct creation, editing, publishing, announcements, grades, missing states, policies, session contracts, draft decisions, class-result refreshes, and confirmed deletes.
3. Preserve fields the professor did not ask to change.
4. After a mutation, report the changed record and the concrete result. Do not repeat the parameters.
5. For deletion, inspect the record first and pass its exact current title as confirmTitle. If it does not match, stop.
6. Use draft_course, draft_ai_assignment, or draft_rubric when the professor asks for a reviewable artifact rather than an immediate operation.
