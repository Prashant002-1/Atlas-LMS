import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveLoginIdentity,
  type LoginIdentity,
  type LoginIdentityLookup,
} from "./login-identity";

const instructor: LoginIdentity = {
  id: "instructor-id",
  orgId: "org-id",
  role: "instructor",
  name: "Demo Instructor",
  image: null,
  passwordHash: "hash",
  loginEmail: "yc-instructor@atlas-lms.com",
};

test("direct login identity takes precedence over an alias", async () => {
  let aliasReads = 0;
  const lookup: LoginIdentityLookup = {
    async direct(email) {
      assert.equal(email, "yc-instructor@atlas-lms.com");
      return instructor;
    },
    async alias() {
      aliasReads += 1;
      return null;
    },
  };

  assert.equal(await resolveLoginIdentity(" YC-Instructor@atlas-lms.com ", lookup), instructor);
  assert.equal(aliasReads, 0);
});

test("an alias retains its login email while resolving to the target identity", async () => {
  const aliasIdentity = { ...instructor, loginEmail: "spc-instructor@atlas-lms.com" };
  const lookup: LoginIdentityLookup = {
    async direct() {
      return null;
    },
    async alias(email) {
      assert.equal(email, "spc-instructor@atlas-lms.com");
      return aliasIdentity;
    },
  };

  assert.deepEqual(await resolveLoginIdentity("SPC-Instructor@atlas-lms.com", lookup), aliasIdentity);
});

test("blank login identity does not query either source", async () => {
  const lookup: LoginIdentityLookup = {
    async direct() {
      assert.fail("direct lookup should not run");
    },
    async alias() {
      assert.fail("alias lookup should not run");
    },
  };

  assert.equal(await resolveLoginIdentity("   ", lookup), null);
});
