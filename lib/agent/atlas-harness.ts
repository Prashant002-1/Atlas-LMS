import path from "node:path";
import { readFile, realpath, stat } from "node:fs/promises";
import { z } from "zod";

const MAX_ATLAS_FILE_BYTES = 64 * 1024;
const atlasRoot = path.resolve(process.cwd(), ".atlas");

const skillEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64),
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(320),
  path: z.string().min(1).max(240),
});

const manifestSchema = z.object({
  version: z.literal(1),
  agent: z.string().min(1).max(240),
  guardrails: z.string().min(1).max(240),
  skills: z.array(skillEntrySchema).max(12),
});

export type AtlasSkillSummary = z.infer<typeof skillEntrySchema>;

export type AtlasHarnessConfig = {
  version: 1;
  agent: string;
  guardrails: string;
  skills: AtlasSkillSummary[];
  skillCatalog: string;
};

function atlasPath(relativePath: string): string {
  if (path.isAbsolute(relativePath)) throw new Error("Atlas paths must be relative.");
  const resolved = path.resolve(atlasRoot, relativePath);
  if (resolved !== atlasRoot && !resolved.startsWith(`${atlasRoot}${path.sep}`)) {
    throw new Error("Atlas path escaped the harness root.");
  }
  return resolved;
}

async function readAtlasText(relativePath: string): Promise<string> {
  const filePath = atlasPath(relativePath);
  const resolvedRoot = await realpath(atlasRoot);
  const resolvedFile = await realpath(filePath);
  if (resolvedFile !== resolvedRoot && !resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Atlas file resolved outside the harness root.");
  }
  const details = await stat(resolvedFile);
  if (!details.isFile() || details.size > MAX_ATLAS_FILE_BYTES) {
    throw new Error("Atlas file is missing or exceeds the size limit.");
  }
  return readFile(resolvedFile, "utf8");
}

async function loadAtlasManifest(): Promise<z.infer<typeof manifestSchema>> {
  const manifest = manifestSchema.parse(JSON.parse(await readAtlasText("manifest.json")));
  const ids = new Set<string>();
  for (const skill of manifest.skills) {
    if (ids.has(skill.id)) throw new Error(`Duplicate Atlas skill: ${skill.id}`);
    ids.add(skill.id);
    atlasPath(skill.path);
  }
  return manifest;
}

export async function loadAtlasHarness(): Promise<AtlasHarnessConfig> {
  const manifest = await loadAtlasManifest();
  const [agent, guardrails] = await Promise.all([
    readAtlasText(manifest.agent),
    readAtlasText(manifest.guardrails),
  ]);

  return {
    version: manifest.version,
    agent: agent.trim(),
    guardrails: guardrails.trim(),
    skills: manifest.skills,
    skillCatalog: manifest.skills.map((skill) => `- ${skill.id}: ${skill.description}`).join("\n"),
  };
}

export async function loadAtlasSkill(skillId: string): Promise<{ skill: AtlasSkillSummary; instructions: string } | null> {
  const manifest = await loadAtlasManifest();
  const skill = manifest.skills.find((entry) => entry.id === skillId);
  if (!skill) return null;
  const instructions = (await readAtlasText(skill.path)).trim();
  return { skill, instructions };
}

const ROLE_CONFUSION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|system|developer)\s+instructions?/i,
  /(?:show|reveal|print|repeat|dump)\s+(?:your\s+)?(?:(?:hidden|privileged)\s+)?(?:system|developer)?\s*(?:prompt|instructions?)/i,
  /(?:you\s+are\s+not|stop\s+being|forget\s+you\s+are)\s+atlas/i,
  /(?:act|behave|pretend|switch|become).{0,32}(?:coding|software|general[- ]purpose)\s+agent/i,
];

export function guardProfessorInput(text: string): { allowed: true } | { allowed: false; reason: string } {
  const compact = text.replace(/\s+/g, " ").trim();
  if (ROLE_CONFUSION_PATTERNS.some((pattern) => pattern.test(compact))) {
    return {
      allowed: false,
      reason: "Atlas can only work as the professor agent for the course in view. Ask it to inspect or draft something for this course.",
    };
  }
  return { allowed: true };
}
