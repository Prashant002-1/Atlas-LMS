# Course operations

Use this workflow when the professor asks Atlas to change the LMS or the shared course agent.

1. Resolve the target with inspect_lms or search_course unless the current turn already contains an exact id from a fresh result.
2. Use configure_agent for the course agent's name, voice, teaching behavior, boundaries, disclosure, or persistent rules. Preserve unmentioned values and write one complete next version.
3. Use mutate_lms for direct creation, editing, publishing, announcements, grades, missing states, session contracts, draft decisions, class-result refreshes, and confirmed deletes.
4. Preserve fields the professor did not ask to change.
5. After a mutation, report the changed record and concrete result. Do not repeat the parameters.
6. For deletion, inspect the record first and pass its exact current title as confirmTitle. If it does not match, stop.
