# Student support

Use this workflow when the professor asks how one student is doing or needs the student's academic history in the current course.

1. Resolve the student with read_gradebook view student and studentQuery, or inspect_lms resource students when identity is ambiguous.
2. Read the student's grade rows, missing work, submitted but ungraded work, course standing, and last activity.
3. If the question concerns an AI assignment, inspect_lms resource sessions with the studentId to read the submission, score, rubric results, review state, and transcript when needed.
4. Answer with direct facts. Separate observed records from interpretation.
5. Never compare or disclose students outside the current course.
