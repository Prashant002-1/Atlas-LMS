import assert from "node:assert/strict";
import test from "node:test";
import { aiAssignmentsServiceConfigured, aiAssignmentsServiceUrl } from "@/lib/ai-assignments/client";

test("the standalone product adapter is disabled when no URL is configured", () => {
  const previous = process.env.ATLAS_AI_ASSIGNMENTS_URL;
  delete process.env.ATLAS_AI_ASSIGNMENTS_URL;
  try {
    assert.equal(aiAssignmentsServiceConfigured(), false);
    assert.equal(aiAssignmentsServiceUrl(), null);
  } finally {
    if (previous === undefined) delete process.env.ATLAS_AI_ASSIGNMENTS_URL;
    else process.env.ATLAS_AI_ASSIGNMENTS_URL = previous;
  }
});

test("the adapter normalizes a configured service URL", () => {
  const previous = process.env.ATLAS_AI_ASSIGNMENTS_URL;
  process.env.ATLAS_AI_ASSIGNMENTS_URL = "http://127.0.0.1:3100/";
  try {
    assert.equal(aiAssignmentsServiceConfigured(), true);
    assert.equal(aiAssignmentsServiceUrl(), "http://127.0.0.1:3100");
  } finally {
    if (previous === undefined) delete process.env.ATLAS_AI_ASSIGNMENTS_URL;
    else process.env.ATLAS_AI_ASSIGNMENTS_URL = previous;
  }
});
