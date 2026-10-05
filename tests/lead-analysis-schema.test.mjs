import assert from "node:assert/strict";
import test from "node:test";
import { LeadAnalysisSchema } from "../lib/lead-analysis-schema.ts";

const validAnalysis = {
  companyName: "Alder & Ash Furnishings",
  contactName: "Maya Chen",
  contactEmail: null,
  projectType: "configurator",
  budgetRange: {
    min: 20000,
    max: 20000,
    currency: null,
    statedText: "around $20,000",
  },
  timeline: {
    requestedLaunch: "Before Christmas",
    urgency: "high",
  },
  requirements: [{ label: "Store platform", value: "Shopify" }],
  missingInformation: [{
    field: "3d-assets",
    question: "Are product CAD or 3D model files available?",
    priority: "high",
  }],
  leadScore: 86,
  priority: "high",
  qualificationSummary: "A defined Shopify project with a clear seasonal launch target.",
  recommendedNextStep: "Confirm product asset readiness and launch scope.",
};

test("accepts a complete analysis", () => {
  assert.equal(LeadAnalysisSchema.safeParse(validAnalysis).success, true);
});

test("accepts nullable source information without inventing values", () => {
  const result = LeadAnalysisSchema.safeParse({
    ...validAnalysis,
    companyName: null,
    contactName: null,
    contactEmail: null,
    budgetRange: { min: null, max: null, currency: null, statedText: null },
    timeline: { requestedLaunch: null, urgency: null },
  });

  assert.equal(result.success, true);
});

test("accepts arbitrary or unknown project types", () => {
  const arbitraryProjectType = LeadAnalysisSchema.safeParse({
    ...validAnalysis,
    projectType: "On-site industrial automation audit",
  });
  const unknownProjectType = LeadAnalysisSchema.safeParse({
    ...validAnalysis,
    projectType: null,
  });

  assert.equal(arbitraryProjectType.success, true);
  assert.equal(unknownProjectType.success, true);
});

test("rejects a lead score outside 0–100", () => {
  assert.equal(LeadAnalysisSchema.safeParse({ ...validAnalysis, leadScore: 101 }).success, false);
});

test("rejects an unsupported priority", () => {
  assert.equal(LeadAnalysisSchema.safeParse({ ...validAnalysis, priority: "urgent" }).success, false);
});