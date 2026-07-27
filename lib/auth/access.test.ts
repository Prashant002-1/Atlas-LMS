import assert from "node:assert/strict";
import test from "node:test";
import { allowedLoginEmails, isLoginEmailAllowed } from "./access";

test("allows existing local accounts when no production allowlist is configured", () => {
  assert.equal(allowedLoginEmails(undefined), null);
  assert.equal(isLoginEmailAllowed("instructor@demo.edu", undefined), true);
});

test("normalizes and enforces the production login allowlist", () => {
  const value = " YC-Instructor@atlas-lms.com, yc-student@atlas-lms.com ";

  assert.deepEqual(
    [...(allowedLoginEmails(value) ?? [])],
    ["yc-instructor@atlas-lms.com", "yc-student@atlas-lms.com"]
  );
  assert.equal(isLoginEmailAllowed("YC-INSTRUCTOR@ATLAS-LMS.COM", value), true);
  assert.equal(isLoginEmailAllowed("admin@demo.edu", value), false);
});
