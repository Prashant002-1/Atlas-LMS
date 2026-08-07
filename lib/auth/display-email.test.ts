import assert from "node:assert/strict";
import test from "node:test";
import { displayLoginEmail, type DisplayEmailLookup } from "./display-email";

function lookup(viewerAlias: string | null, targetAliases: string[]): DisplayEmailLookup {
  return {
    async byEmail() {
      return viewerAlias;
    },
    async byUserId() {
      return targetAliases;
    },
  };
}

test("direct credentials keep canonical record emails", async () => {
  const email = await displayLoginEmail(
    {
      viewerEmail: "yc-instructor@atlas-lms.com",
      userId: "student-id",
      fallback: "yc-student@atlas-lms.com",
    },
    lookup(null, ["spc-student@atlas-lms.com"])
  );

  assert.equal(email, "yc-student@atlas-lms.com");
});

test("alias credentials present target users through the same credential namespace", async () => {
  const email = await displayLoginEmail(
    {
      viewerEmail: "spc-instructor@atlas-lms.com",
      userId: "student-id",
      fallback: "yc-student@atlas-lms.com",
    },
    lookup("spc-instructor@atlas-lms.com", ["another-student@atlas-lms.com", "spc-student@atlas-lms.com"])
  );

  assert.equal(email, "spc-student@atlas-lms.com");
});

test("alias credentials fall back when the target has no matching alias", async () => {
  const email = await displayLoginEmail(
    {
      viewerEmail: "spc-instructor@atlas-lms.com",
      userId: "student-id",
      fallback: "student@atlas-lms.com",
    },
    lookup("spc-instructor@atlas-lms.com", [])
  );

  assert.equal(email, "student@atlas-lms.com");
});
