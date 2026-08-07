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
      viewerEmail: "pilot-instructor@example.edu",
      userId: "student-id",
      fallback: "pilot-student@example.edu",
    },
    lookup(null, ["alias-student@example.edu"])
  );

  assert.equal(email, "pilot-student@example.edu");
});

test("alias credentials present target users through the same credential namespace", async () => {
  const email = await displayLoginEmail(
    {
      viewerEmail: "alias-instructor@example.edu",
      userId: "student-id",
      fallback: "pilot-student@example.edu",
    },
    lookup("alias-instructor@example.edu", ["another-student@example.edu", "alias-student@example.edu"])
  );

  assert.equal(email, "alias-student@example.edu");
});

test("alias credentials fall back when the target has no matching alias", async () => {
  const email = await displayLoginEmail(
    {
      viewerEmail: "alias-instructor@example.edu",
      userId: "student-id",
      fallback: "student@example.edu",
    },
    lookup("alias-instructor@example.edu", [])
  );

  assert.equal(email, "student@example.edu");
});
