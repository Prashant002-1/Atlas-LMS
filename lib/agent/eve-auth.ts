import { createHmac } from "node:crypto";
import type { Role } from "@/lib/auth/session";

export const EVE_BRIDGE_ISSUER = "atlas-lms";
export const EVE_BRIDGE_AUDIENCE = "atlas-eve";

type EveBridgeClaims = {
  userId: string;
  orgId: string;
  role: Role;
  courseId: string;
  atlasSessionId: string;
};

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function eveBridgeSecret(): string | null {
  const secret = process.env.ATLAS_EVE_AUTH_SECRET ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  return secret.trim() ? secret : null;
}

export function signEveBridgeToken(claims: EveBridgeClaims): string | null {
  const secret = eveBridgeSecret();
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: EVE_BRIDGE_ISSUER,
    aud: EVE_BRIDGE_AUDIENCE,
    sub: `user:${claims.userId}`,
    userId: claims.userId,
    orgId: claims.orgId,
    role: claims.role,
    courseId: claims.courseId,
    atlasSessionId: claims.atlasSessionId,
    iat: now,
    exp: now + 120,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createHmac("sha256", secret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

export function eveBridgeAuthorization(claims: EveBridgeClaims): string | null {
  const token = signEveBridgeToken(claims);
  return token ? `Bearer ${token}` : null;
}
