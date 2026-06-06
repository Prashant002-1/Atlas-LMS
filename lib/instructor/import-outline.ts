export type ParsedImport = {
  title: string;
  intent: string;
  courseCode: string;
  objectives: Array<{
    code: string;
    description: string;
    assessmentWeight: number;
  }>;
  modules: Array<{
    name: string;
    summaryMd: string;
    objectiveCodes: string[];
  }>;
  assignments: Array<{
    name: string;
    descriptionMd: string;
    objectiveCodes: string[];
    pointsPossible: number;
  }>;
};

export function parseCourseImportIntent(intent: string, courseCode: string): ParsedImport {
  const lines = intent
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter(Boolean);
  const objectives = new Map<string, string>();
  const modules: ParsedImport["modules"] = [];
  const assignments: ParsedImport["assignments"] = [];

  for (const line of lines) {
    const objective = parseObjectiveLine(line);
    if (objective) {
      objectives.set(objective.code, objective.description);
      continue;
    }

    const assignment = parseAssignmentLine(line);
    if (assignment) {
      assignments.push(assignment);
      continue;
    }

    const moduleDraft = parseModuleLine(line);
    if (moduleDraft) {
      modules.push(moduleDraft);
    }
  }

  const foundCodes = new Set<string>();
  for (const item of [...modules, ...assignments]) {
    item.objectiveCodes.forEach((code) => foundCodes.add(code));
  }
  for (const code of foundCodes) {
    if (!objectives.has(code)) objectives.set(code, `Course objective ${code}`);
  }

  return {
    title: "Course outline",
    intent,
    courseCode,
    objectives: withBalancedWeights([...objectives.entries()].map(([code, description]) => ({ code, description }))),
    modules,
    assignments,
  };
}

export function importSummary(diff: unknown) {
  const imported = normalizeImportDiff(diff, "");
  return `Draft ${countLabel(imported.modules.length, "week")}, ${countLabel(imported.assignments.length, "assignment")}, and ${countLabel(
    imported.objectives.length,
    "objective"
  )}.`;
}

export function hasImportRows(diff: unknown) {
  const imported = normalizeImportDiff(diff, "");
  return imported.objectives.length + imported.modules.length + imported.assignments.length > 0;
}

export function normalizeImportDiff(diff: unknown, fallback: string): ParsedImport {
  if (!diff || typeof diff !== "object") {
    return parseCourseImportIntent(fallback, "");
  }
  const record = diff as Record<string, unknown>;
  const intent = stringFromRecord(record, "intent") || fallback;
  const courseCode = stringFromRecord(record, "courseCode");
  const title = stringFromRecord(record, "title") || "Course outline";

  return {
    title,
    intent,
    courseCode,
    objectives: normalizeObjectiveDrafts(record.objectives),
    modules: normalizeModuleDrafts(record.modules),
    assignments: normalizeAssignmentDrafts(record.assignments),
  };
}

export function withReferencedObjectives(imported: ParsedImport): ParsedImport {
  const objectives = new Map(imported.objectives.map((objective) => [objective.code, objective.description]));
  for (const item of [...imported.modules, ...imported.assignments]) {
    for (const code of item.objectiveCodes) {
      if (!objectives.has(code)) objectives.set(code, `Course objective ${code}`);
    }
  }
  return {
    ...imported,
    objectives: withBalancedWeights([...objectives.entries()].map(([code, description]) => ({ code, description }))),
  };
}

function parseObjectiveLine(line: string) {
  const match = line.match(/^(?:objective\s*)?(LO\d+)\s*[:\-]\s*(.+)$/i);
  if (!match?.[1] || !match[2]) return null;
  return {
    code: match[1].toUpperCase(),
    description: stripObjectiveCodes(match[2]),
  };
}

function parseModuleLine(line: string): ParsedImport["modules"][number] | null {
  const weekMatch = line.match(/^(?:week\s*)?(\d{1,2})\s*[:.)-]\s*(.+)$/i);
  const moduleMatch = line.match(/^module\s*[:\-]\s*(.+)$/i);
  const text = weekMatch?.[2] ?? moduleMatch?.[1];
  if (!text) return null;

  const objectiveCodes = extractObjectiveCodes(text);
  const { title, detail } = splitTitleDetail(stripObjectiveCodes(text));
  const name = title.replace(/\s+-\s+$/, "").trim();
  if (!name) return null;

  return {
    name,
    summaryMd: detail || defaultModuleDetail(objectiveCodes),
    objectiveCodes,
  };
}

function parseAssignmentLine(line: string): ParsedImport["assignments"][number] | null {
  const match = line.match(/^(assignment|work|quiz|project|problem set)\s*[:\-]?\s*(.+)$/i);
  if (!match?.[2]) return null;

  const objectiveCodes = extractObjectiveCodes(match[2]);
  const { title, detail } = splitTitleDetail(stripObjectiveCodes(match[2]));
  const name = title.trim();
  if (!name) return null;

  return {
    name,
    descriptionMd: detail || defaultAssignmentDetail(objectiveCodes),
    objectiveCodes,
    pointsPossible: 100,
  };
}

function extractObjectiveCodes(value: string) {
  return Array.from(new Set(value.match(/\bLO\d+\b/gi)?.map((code) => code.toUpperCase()) ?? []));
}

function stripObjectiveCodes(value: string) {
  return value
    .replace(/\bLO\d+\b/gi, "")
    .replace(/\s*(?:,|\/|\+|and)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*-\s*$/, "")
    .trim();
}

function splitTitleDetail(value: string) {
  const cleaned = value.trim();
  const separator = cleaned.match(/\s[-:]\s/);
  if (!separator || separator.index === undefined) {
    return { title: cleaned, detail: "" };
  }

  const title = cleaned.slice(0, separator.index).trim();
  const detail = cleaned.slice(separator.index + separator[0].length).trim();
  return { title, detail };
}

function defaultModuleDetail(objectiveCodes: string[]) {
  return objectiveCodes.length > 0 ? `Supports ${objectiveCodes.join(", ")}.` : "Adds a course week.";
}

function defaultAssignmentDetail(objectiveCodes: string[]) {
  return objectiveCodes.length > 0 ? `Checks ${objectiveCodes.join(", ")}.` : "Adds course work.";
}

function normalizeObjectiveDrafts(value: unknown): ParsedImport["objectives"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const code = typeof record.code === "string" ? record.code.toUpperCase().trim() : "";
      const description = typeof record.description === "string" ? record.description.trim() : "";
      const assessmentWeight = numberFromRecord(record, "assessmentWeight");
      return code && description ? { code, description, assessmentWeight } : null;
    })
    .filter((item): item is ParsedImport["objectives"][number] => Boolean(item));
}

function withBalancedWeights(objectives: Array<{ code: string; description: string }>): ParsedImport["objectives"] {
  if (objectives.length === 0) return [];
  const evenWeight = 1 / objectives.length;
  return objectives.map((objective) => ({
    ...objective,
    assessmentWeight: evenWeight,
  }));
}

function normalizeModuleDrafts(value: unknown): ParsedImport["modules"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const objectiveCodes = Array.isArray(record.objectiveCodes)
        ? record.objectiveCodes.filter((code): code is string => typeof code === "string").map((code) => code.toUpperCase())
        : [];
      const summaryMd = typeof record.summaryMd === "string" ? record.summaryMd.trim() : defaultModuleDetail(objectiveCodes);
      return name ? { name, summaryMd, objectiveCodes: Array.from(new Set(objectiveCodes)) } : null;
    })
    .filter((item): item is ParsedImport["modules"][number] => Boolean(item));
}

function normalizeAssignmentDrafts(value: unknown): ParsedImport["assignments"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const pointsPossible = typeof record.pointsPossible === "number" ? record.pointsPossible : 100;
      const objectiveCodes = Array.isArray(record.objectiveCodes)
        ? record.objectiveCodes.filter((code): code is string => typeof code === "string").map((code) => code.toUpperCase())
        : [];
      const descriptionMd = typeof record.descriptionMd === "string" ? record.descriptionMd.trim() : defaultAssignmentDetail(objectiveCodes);
      return name ? { name, descriptionMd, pointsPossible, objectiveCodes: Array.from(new Set(objectiveCodes)) } : null;
    })
    .filter((item): item is ParsedImport["assignments"][number] => Boolean(item));
}

function stringFromRecord(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function numberFromRecord(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function countLabel(count: number, singular: string) {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}
