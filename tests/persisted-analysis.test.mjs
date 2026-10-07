import assert from "node:assert/strict";
import test from "node:test";
import { parsePersistedAnalysis } from "../lib/lead-analysis-schema.ts";

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

test("restores a schema-valid analysis JSON record", () => {
  assert.deepEqual(parsePersistedAnalysis(validAnalysis), validAnalysis);
});

test("rejects malformed or provider-extended stored JSON", () => {
  assert.equal(parsePersistedAnalysis({ ...validAnalysis, leadScore: 101 }), null);
  assert.equal(parsePersistedAnalysis({ ...validAnalysis, untrustedField: "unexpected" }), null);
});
