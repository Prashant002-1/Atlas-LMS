/**
 * Student submissions that look like a real class handed them in.
 *
 * The seed gave every student on every assignment a tidy three-sentence
 * paragraph in the same register, which made the grading surfaces impossible to
 * judge: a table of thirty identical-length previews tells you nothing about
 * whether the layout works, and a submission that is always prose hides the
 * fact that a submission is not always prose.
 *
 * So submissions vary along three axes that matter to the UI:
 *
 * Shape. Some students upload a PDF or a spreadsheet, some paste a link to a
 * doc, some write in the box, and some hand in nothing. A file submission
 * carries a `url` and almost no body, which is what makes the submission page
 * render an artifact rather than a paragraph.
 *
 * Length. A one-line answer, a couple of sentences, and a long worked solution
 * all appear, because a row of previews has to survive all three.
 *
 * Voice. Confident, hedging, terse, over-explaining, and slightly panicked all
 * read differently, and a class where everyone writes the same way is the one
 * thing a demo audience notices immediately.
 *
 * Deterministic: shape and voice derive from the student key and assignment key,
 * so re-seeding produces the same world and a screenshot stays valid.
 */

export type SubmissionShape = "text_short" | "text_long" | "file" | "link" | "none";

export type ShapedSubmission = {
  shape: SubmissionShape;
  body: string | null;
  url: string | null;
  submissionType: string | null;
};

/** Stable small hash so a (student, assignment) pair always lands the same way. */
function hashOf(...parts: string[]): number {
  let hash = 0;
  for (const part of parts.join(":")) {
    hash = (hash * 31 + part.charCodeAt(0)) % 100_000;
  }
  return hash;
}

/**
 * Which shape this student used on this assignment. Problem sets skew toward
 * uploaded work because that is how a real econ problem set with graphs arrives;
 * exams and written pieces skew toward text.
 */
export function shapeFor(args: {
  studentKey: string;
  assignmentKey: string;
  archetype: string;
}): SubmissionShape {
  const roll = hashOf(args.studentKey, args.assignmentKey) % 100;
  const graphHeavy = args.assignmentKey.startsWith("ps");

  if (graphHeavy) {
    if (roll < 34) return "file";
    if (roll < 44) return "link";
    if (roll < 74) return "text_short";
    return "text_long";
  }
  if (roll < 12) return "file";
  if (roll < 18) return "link";
  if (roll < 58) return "text_short";
  return "text_long";
}

const FILE_KINDS = [
  { ext: "pdf", label: "problem-set" },
  { ext: "pdf", label: "worked-solution" },
  { ext: "xlsx", label: "calculations" },
  { ext: "pdf", label: "graphs" },
  { ext: "docx", label: "writeup" },
];

/** A short note a student actually writes next to an upload. */
const FILE_NOTES = [
  "Graphs are on page 2. I labeled the shift and the movement separately.",
  "Attached. My equilibrium work is in the spreadsheet, second tab.",
  "Uploaded as a PDF because the graph would not paste cleanly.",
  "Scanned my handwritten work. The elasticity calculation is the last page.",
  "Attached the writeup. Let me know if the second graph is unreadable.",
  null,
];

const LINK_NOTES = [
  "Shared doc, comment access on.",
  "Link to my doc. The graphs are images near the top.",
  "Everything is in the linked doc, including the table.",
];

/** Terse answers. A real class has these and a grading table has to hold them. */
const SHORT_ANSWERS = [
  "Price rises, quantity falls. It is a shift in demand, not a movement along it.",
  "Total revenue went down because demand is elastic in that range.",
  "MC = MR at 4,200 subscribers. Profit is highest there.",
  "I think the curve shifts left. Server cost is a supply factor, not a demand one.",
  "Consumer surplus shrinks by the area between the two prices under the curve.",
  "Elasticity is percentage change, slope is not. That was my mistake on the exam.",
  "Used the second-degree price discrimination case from the Week 6 reading.",
  "Answer attached below. Short version: the price hike lost more subscribers than it gained in revenue.",
];

/** Voices, so the class does not read as one person writing thirty times. */
const VOICES = {
  confident: (body: string) => body,
  hedging: (body: string) => `I think ${lowerFirst(body)} I am not fully sure about the last step.`,
  terse: (body: string) => firstSentence(body),
  overexplaining: (body: string) =>
    `${body}\n\nTo be clear about my reasoning: I started from the schedule, wrote the equilibrium condition, and only then drew anything. I did not want to rely on the picture to make the argument for me.`,
  worried: (body: string) => `${body}\n\nI am not confident about this one. Can we go over it in office hours?`,
} as const;

type VoiceName = keyof typeof VOICES;
const VOICE_NAMES = Object.keys(VOICES) as VoiceName[];

export function voiceFor(studentKey: string): VoiceName {
  return VOICE_NAMES[hashOf(studentKey, "voice") % VOICE_NAMES.length];
}

/**
 * Build one submission. `longBody` is the seed's existing rich paragraph, kept
 * for the students who genuinely wrote at length, so nothing well-written is
 * thrown away.
 */
export function shapedSubmission(args: {
  studentKey: string;
  studentName: string;
  assignmentKey: string;
  archetype: string;
  longBody: string;
}): ShapedSubmission {
  const shape = shapeFor(args);
  const roll = hashOf(args.studentKey, args.assignmentKey);
  const slug = args.studentName.split(/\s+/)[0]?.toLowerCase() ?? "student";

  if (shape === "none") {
    return { shape, body: null, url: null, submissionType: null };
  }

  if (shape === "file") {
    const kind = FILE_KINDS[roll % FILE_KINDS.length];
    const note = FILE_NOTES[roll % FILE_NOTES.length];
    return {
      shape,
      body: note,
      url: `https://files.demo.edu/submissions/${args.assignmentKey}/${slug}-${kind.label}.${kind.ext}`,
      submissionType: "file",
    };
  }

  if (shape === "link") {
    return {
      shape,
      body: LINK_NOTES[roll % LINK_NOTES.length],
      url: `https://docs.demo.edu/d/${args.assignmentKey}-${slug}-${(roll % 900) + 100}`,
      submissionType: "online_url",
    };
  }

  if (shape === "text_short") {
    const answer = SHORT_ANSWERS[roll % SHORT_ANSWERS.length];
    return { shape, body: VOICES[voiceFor(args.studentKey)](answer), url: null, submissionType: "text" };
  }

  /* The long shape keeps the seed's own writing, in this student's voice. */
  const voice = voiceFor(args.studentKey);
  const body = voice === "terse" ? firstSentence(args.longBody) : VOICES[voice](args.longBody);
  return { shape, body, url: null, submissionType: "text" };
}

function firstSentence(value: string): string {
  const match = /^[^.!?]*[.!?]/.exec(value.trim());
  return (match?.[0] ?? value.trim().slice(0, 160)).trim();
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
