import { eveChannel } from "eve/channels/eve";
import { jwtHmac, localDev, vercelOidc, type AuthFn } from "eve/channels/auth";

function atlasBridgeAuth(): AuthFn<Request> {
  const secret = process.env.ATLAS_EVE_AUTH_SECRET ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  if (!secret.trim()) return () => null;

  return jwtHmac({
    algorithm: "HS256",
    audiences: ["atlas-eve"],
    issuer: "atlas-lms",
    secret,
  });
}

export default eveChannel({
  auth: [atlasBridgeAuth(), localDev(), vercelOidc()],
});
