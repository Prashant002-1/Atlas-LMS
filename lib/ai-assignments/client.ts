import { z } from "zod";

const healthSchema = z.object({
  product: z.literal("atlas-ai-assignments"),
  status: z.literal("ok"),
  apiVersion: z.number().int().positive(),
  adapterContractVersion: z.number().int().positive(),
  capabilities: z.object({
    standalone: z.boolean(),
    atlasAdapter: z.string(),
    canvasLti: z.boolean(),
  }),
});

export type AiAssignmentsHealth = z.infer<typeof healthSchema>;

export function aiAssignmentsServiceUrl(): string | null {
  const configured = process.env.ATLAS_AI_ASSIGNMENTS_URL?.trim();
  if (!configured) return null;
  const parsed = new URL(configured);
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("ATLAS_AI_ASSIGNMENTS_URL must use HTTPS in production.");
  }
  return parsed.toString().replace(/\/$/, "");
}

export function aiAssignmentsServiceConfigured(): boolean {
  return Boolean(process.env.ATLAS_AI_ASSIGNMENTS_URL?.trim());
}

export async function readAiAssignmentsHealth(): Promise<AiAssignmentsHealth | null> {
  const baseUrl = aiAssignmentsServiceUrl();
  if (!baseUrl) return null;
  const response = await fetch(`${baseUrl}/api/v1/health`, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Atlas AI Assignments health check failed with ${response.status}.`);
  return healthSchema.parse(await response.json());
}
