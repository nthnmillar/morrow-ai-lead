import assert from "node:assert/strict";
import test from "node:test";
import {
  DraftReplyPayloadSchema,
  parsePersistedAction,
  transitionActionStatus,
} from "../lib/action-schema.ts";

const validPayload = {
  recipientName: "Maya Chen",
  to: "maya@example.com",
  tone: "professional",
  keyPoints: ["Confirm which 3D assets are available."],
  subject: "Next steps for your configurator",
  body: "Hi Maya,\n\nThanks for the details.",
};

const validAction = {
  id: "11111111-1111-4111-8111-111111111111",
  enquiryId: "ENQ-2047",
  analysisId: "22222222-2222-4222-8222-222222222222",
  type: "draft_reply",
  status: "proposed",
  payload: validPayload,
  proposedAt: "2026-10-08T05:00:00.000Z",
  updatedAt: "2026-10-08T05:00:00.000Z",
  approvedByUserAt: null,
  rejectedAt: null,
  executedAt: null,
  errorMessage: null,
};

test("parses a valid persisted Action", () => {
  assert.deepEqual(parsePersistedAction(validAction), validAction);
});

test("rejects invalid Action types and statuses", () => {
  assert.equal(parsePersistedAction({ ...validAction, type: "webhook" }), null);
  assert.equal(parsePersistedAction({ ...validAction, status: "executed" }), null);
});

test("rejects malformed persisted payloads", () => {
  assert.equal(parsePersistedAction({ ...validAction, payload: { ...validPayload, to: "not-an-email" } }), null);
  assert.equal(parsePersistedAction({ ...validAction, payload: { ...validPayload, providerOutput: {} } }), null);
});

test("rejects decision timestamps that contradict status", () => {
  assert.equal(parsePersistedAction({ ...validAction, approvedByUserAt: validAction.updatedAt }), null);
  assert.equal(parsePersistedAction({ ...validAction, status: "approved" }), null);
});

test("keeps edited draft content schema-valid", () => {
  const edited = DraftReplyPayloadSchema.safeParse({ ...validPayload, body: "Hi Maya,\n\nCould we confirm the available assets?" });
  assert.equal(edited.success, true);
});

test("allows review transitions and rejects changes to terminal Actions", () => {
  assert.equal(transitionActionStatus("proposed", "save_edit"), "edited");
  assert.equal(transitionActionStatus("proposed", "approve"), "approved");
  assert.equal(transitionActionStatus("edited", "approve"), "approved");
  assert.equal(transitionActionStatus("edited", "cancel"), "cancelled");
  assert.equal(transitionActionStatus("approved", "cancel"), null);
  assert.equal(transitionActionStatus("cancelled", "approve"), null);
});
