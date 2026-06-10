/**
 * Shared record-view types — the shapes course records take on screen.
 * (Formerly defined next to the demo fixture; the fixture is gone, the product
 * renders only real rows.)
 */

export type Objective = {
  code: string;
  title: string;
  description: string;
  bloom: string;
  assessedWeight: number;
  coverage: number;
  evidence: string[];
};

export type ModuleDraft = {
  id?: string;
  week: string;
  title: string;
  summary?: string | null;
  objectiveCodes: string[];
  status: "draft" | "needs-review" | "approved";
};
