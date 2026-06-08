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
    source?: "sample_practice";
  }>;
  assignments: Array<{
    name: string;
    descriptionMd: string;
    objectiveCodes: string[];
    pointsPossible: number;
  }>;
};

export type ImportCommandFocus = {
  code?: string | null;
  title?: string | null;
  description?: string | null;
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

export function inferCourseCommandImport(
  intent: string,
  courseCode: string,
  focus: ImportCommandFocus = {}
): ParsedImport {
  const objectiveCodes = commandObjectiveCodes(intent, focus.code);
  const shouldDraft =
    /\b(add|build|create|draft|generate|give|make|prepare|turn)\b/i.test(intent) &&
    /\b(assignment|checkpoint|lesson|material|module|practice|problem|project|quiz|sequence|week|work)\b/i.test(intent);

  if (!shouldDraft) {
    return emptyImport(intent, courseCode);
  }

  const title = commandTitle(intent, focus.title);
  const practiceBase = commandPracticeBase(intent, focus.title);
  const shifts = commandPracticeShifts(intent, focus.description);
  const samplePractice = isSamplePracticeRequest(intent);
  const wantsWeek = samplePractice || /\b(lesson|material|module|practice|sequence|week)\b/i.test(intent);
  const wantsWork = /\b(assignment|checkpoint|practice|problem|project|quiz|work)\b/i.test(intent);
  const modules: ParsedImport["modules"] = wantsWeek
    ? [
        {
          name: title,
          summaryMd: samplePractice
            ? samplePracticeSummary(intent, objectiveCodes, practiceBase, shifts, focus.description)
            : commandSummary(intent, objectiveCodes, practiceBase, shifts),
          objectiveCodes,
          source: samplePractice ? "sample_practice" : undefined,
        },
      ]
    : [];
  const assignments: ParsedImport["assignments"] = wantsWork || modules.length === 0
    ? [
        {
          name: commandAssignmentName(title, intent),
          descriptionMd: samplePractice
            ? samplePracticeAssignmentDetail(intent, objectiveCodes, practiceBase, shifts, focus.description)
            : commandAssignmentDetail(intent, objectiveCodes, practiceBase, shifts),
          objectiveCodes,
          pointsPossible: 100,
        },
      ]
    : [];
  const objectives = focus.code && focus.description
    ? [{ code: focus.code.toUpperCase(), description: focus.description, assessmentWeight: 1 }]
    : [];

  return withReferencedObjectives({
    title: "Course request",
    intent,
    courseCode,
    objectives,
    modules,
    assignments,
  });
}

export function importSummary(diff: unknown) {
  const imported = normalizeImportDiff(diff, "");
  const sampleMaterials = imported.modules.filter((module) => module.source === "sample_practice").length;
  if (sampleMaterials > 0) {
    return `Draft ${countLabel(sampleMaterials, "material")}, ${countLabel(imported.assignments.length, "work item")}, and ${countLabel(
      imported.objectives.length,
      "objective"
    )}.`;
  }
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

function emptyImport(intent: string, courseCode: string): ParsedImport {
  return {
    title: "Course request",
    intent,
    courseCode,
    objectives: [],
    modules: [],
    assignments: [],
  };
}

function commandObjectiveCodes(intent: string, focusCode?: string | null) {
  const codes = extractObjectiveCodes(intent);
  const normalizedFocus = focusCode?.trim().toUpperCase();
  if (normalizedFocus && /^[A-Z]{1,4}\d{1,3}$/.test(normalizedFocus)) {
    codes.push(normalizedFocus);
  }
  return Array.from(new Set(codes));
}

function commandTitle(intent: string, focusTitle?: string | null) {
  const text = intent.toLowerCase();
  if (text.includes("regression")) return "Regression practice";
  if (text.includes("clinic") || text.includes("wait")) return "Clinic wait practice";
  if (text.includes("hypothesis") || text.includes("inference")) return "Inference practice";
  if (text.includes("uncertainty")) return "Uncertainty practice";
  if (focusTitle?.trim()) return `${focusTitle.trim()} practice`;
  return "Practice sequence";
}

function commandPracticeBase(intent: string, focusTitle?: string | null) {
  const explicitBase = firstLabeledItem(intent, "Base");
  if (explicitBase) return sentenceCase(explicitBase);

  const sampleMatch = intent.match(
    /\b(?:from|using|with|around|based on)\s+(?:the\s+)?(.{3,80}?)\s+(sample|dataset|data|case|scenario|problem frame)\b/i
  );
  const namedBase = sampleMatch?.[1] ? `${sampleMatch[1]} ${sampleMatch[2]}` : "";
  const cleaned = namedBase
    .replace(/\b(?:a|an|the|some|provided|sample|dataset|data|case|scenario|problem frame)\s*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned) return sentenceCase(`${cleaned} ${sampleMatch?.[2] ?? "sample"}`);
  if (/\bclinic|wait\b/i.test(intent)) return "Clinic wait sample";
  if (/\bregression|housing|energy\b/i.test(intent)) return "Housing energy sample";
  if (/\bcommute|survey\b/i.test(intent)) return "Commute survey";
  if (focusTitle?.trim()) return `${focusTitle.trim()} example`;
  return "Course sample";
}

function commandPracticeShifts(intent: string, focusDescription?: string | null) {
  const explicitShifts = labeledItems(intent, "Shifts");
  if (explicitShifts.length > 0) return explicitShifts.slice(0, 4);

  const text = `${intent} ${focusDescription ?? ""}`.toLowerCase();
  const shifts: string[] = [];

  if (text.includes("hypothesis") || text.includes("test")) shifts.push("State the hypotheses and choose the test");
  if (text.includes("confidence") || text.includes("interval")) shifts.push("Build an interval and interpret uncertainty");
  if (text.includes("assumption")) shifts.push("Check the assumption that matters");
  if (text.includes("regression") || text.includes("coefficient")) shifts.push("Interpret one coefficient in context");
  if (text.includes("explain") || text.includes("non technical") || text.includes("non-technical")) {
    shifts.push("Rewrite the result for a non-technical reader");
  }
  if (text.includes("summary") || text.includes("descriptive") || text.includes("distribution")) {
    shifts.push("Choose the right summary and explain the distribution");
  }

  if (shifts.length === 0) {
    shifts.push("Solve one version", "Change one assumption", "Explain the evidence");
  }

  return Array.from(new Set(shifts)).slice(0, 4);
}

function isSamplePracticeRequest(intent: string) {
  return /\b(sample|dataset|data set|data|case|scenario|problem frame|base)\b/i.test(intent) && /\b(practice|problem|assignment|checkpoint|material|week|lesson|shift|variant)\b/i.test(intent);
}

function samplePracticeSummary(
  intent: string,
  objectiveCodes: string[],
  practiceBase: string,
  shifts: string[],
  focusDescription?: string | null
) {
  const concepts = sampleConcepts(intent, focusDescription, objectiveCodes);
  const conceptText = concepts.length > 0 ? ` Concepts: ${concepts.join("; ")}.` : "";
  const context = stripCommandLabels(intent);
  return `Base: ${practiceBase}. Shifts: ${shifts.join("; ")}.${conceptText}${context ? ` ${context}` : ""}`.slice(0, 1200);
}

function samplePracticeAssignmentDetail(
  intent: string,
  objectiveCodes: string[],
  practiceBase: string,
  shifts: string[],
  focusDescription?: string | null
) {
  const concepts = sampleConcepts(intent, focusDescription, objectiveCodes);
  const conceptText = concepts.length > 0 ? ` Cover ${concepts.join("; ")}.` : "";
  const alignText = objectiveCodes.length > 0 ? ` Align to ${objectiveCodes.join(", ")}.` : "";
  return `Read the linked material, then use ${practiceBase}. Choose one shift: ${shifts.join("; ")}.${conceptText}${alignText}`.slice(0, 1200);
}

function sampleConcepts(intent: string, focusDescription: string | null | undefined, objectiveCodes: string[]) {
  const explicit = labeledItems(intent, "Concepts");
  if (explicit.length > 0) return explicit.slice(0, 4);

  const text = `${intent} ${focusDescription ?? ""}`.toLowerCase();
  const concepts: string[] = [];
  if (text.includes("hypothesis") || text.includes("hypotheses") || text.includes("test")) concepts.push("hypotheses");
  if (text.includes("confidence") || text.includes("interval")) concepts.push("confidence intervals");
  if (text.includes("assumption")) concepts.push("assumptions");
  if (text.includes("regression") || text.includes("coefficient")) concepts.push("regression interpretation");
  if (text.includes("summary") || text.includes("descriptive") || text.includes("distribution")) concepts.push("distribution summaries");
  if (text.includes("uncertainty") || text.includes("non technical") || text.includes("non-technical")) concepts.push("communicating uncertainty");

  if (concepts.length === 0 && objectiveCodes.length > 0) {
    concepts.push(...objectiveCodes.map((code) => `practice for ${code}`));
  }

  return Array.from(new Set(concepts)).slice(0, 4);
}

function stripCommandLabels(value: string) {
  return value
    .replace(/\bBase\s*:\s*.*?(?=\b(?:Shifts|Concepts)\s*:|$)/gi, "")
    .replace(/\bShifts\s*:\s*.*?(?=\b(?:Base|Concepts)\s*:|$)/gi, "")
    .replace(/\bConcepts\s*:\s*.*?(?=\b(?:Base|Shifts)\s*:|$)/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;.,-]+|[\s:;.,-]+$/g, "")
    .trim();
}

function firstLabeledItem(value: string, label: "Base" | "Shifts" | "Concepts") {
  return labeledItems(value, label)[0];
}

function labeledItems(value: string, label: "Base" | "Shifts" | "Concepts") {
  const marker = new RegExp(`\\b${label}\\s*:`, "i").exec(value);
  if (!marker) return [];

  const rest = value.slice(marker.index + marker[0].length);
  const nextMarker = /\b(?:Base|Shifts|Concepts)\s*:/i.exec(rest);
  const segment = (nextMarker ? rest.slice(0, nextMarker.index) : rest)
    .replace(/\s+/g, " ")
    .replace(/^[\s:;.,-]+|[\s:;.,-]+$/g, "")
    .trim();

  return segment
    .split(/\s*(?:;|\n|,|\.)\s*/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 0)
    .slice(0, 6);
}

function commandAssignmentName(title: string, intent: string) {
  if (/\b(check|checkpoint)\b/i.test(intent)) return `${title} checkpoint`;
  if (/\b(quiz)\b/i.test(intent)) return `${title} quiz`;
  if (/\b(project)\b/i.test(intent)) return `${title} project`;
  return `${title} check`;
}

function commandSummary(intent: string, objectiveCodes: string[], practiceBase: string, shifts: string[]) {
  const suffix = objectiveCodes.length > 0 ? ` Supports ${objectiveCodes.join(", ")}.` : "";
  return `Base: ${practiceBase}. Shifts: ${shifts.join("; ")}. ${intent.replace(/\s+/g, " ").trim()}${suffix}`.slice(0, 1200);
}

function commandAssignmentDetail(intent: string, objectiveCodes: string[], practiceBase: string, shifts: string[]) {
  const prefix = `Use ${practiceBase}. Choose one shift: ${shifts.join("; ")}. ${intent.replace(/\s+/g, " ").trim()}`;
  const suffix = objectiveCodes.length > 0 ? ` Align to ${objectiveCodes.join(", ")}.` : "";
  return `${prefix}${suffix}`.slice(0, 1200);
}

function sentenceCase(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim().toLowerCase();
  return cleaned ? `${cleaned[0]?.toUpperCase()}${cleaned.slice(1)}` : cleaned;
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
      if (!name) return null;
      const draft: ParsedImport["modules"][number] = {
        name,
        summaryMd,
        objectiveCodes: Array.from(new Set(objectiveCodes)),
      };
      if (record.source === "sample_practice") {
        draft.source = "sample_practice";
      }
      return draft;
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
