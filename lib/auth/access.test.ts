import assert from "node:assert/strict";
import test from "node:test";
import { allowedLoginEmails, isLoginEmailAllowed } from "./access";

test("allows existing local accounts when no production allowlist is configured", () => {
  assert.equal(allowedLoginEmails(undefined), null);
  assert.equal(isLoginEmailAllowed("instructor@demo.edu", undefined), true);
});

test("normalizes and enforces the production login allowlist", () => {
  const value = " Pilot-Instructor@example.edu, pilot-student@example.edu ";

  assert.deepEqual(
    [...(allowedLoginEmails(value) ?? [])],
    ["pilot-instructor@example.edu", "pilot-student@example.edu"]
  );
  assert.equal(isLoginEmailAllowed("PILOT-INSTRUCTOR@EXAMPLE.EDU", value), true);
  assert.equal(isLoginEmailAllowed("admin@demo.edu", value), false);
});
