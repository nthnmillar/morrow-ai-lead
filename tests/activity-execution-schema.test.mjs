import assert from "node:assert/strict";
import test from "node:test";
import { parsePersistedActivityEvent } from "../lib/activity-event-schema.ts";
import {
  EmailExecutionResultSchema,
  buildTestEmailRequest,
  canClaimActionExecution,
} from "../lib/execution-schema.ts";

const validEvent = {
  id: "11111111-1111-4111-8111-111111111111",
  enquiryId: "ENQ-2047",
  analysisId: "22222222-2222-4222-8222-222222222222",
  actionId: null,
  type: "validated",
  summary: "AI analysis completed and passed validation.",
  details: {},
  createdAt: "2026-10-08T10:00:00.000Z",
};

test("validates persisted ActivityEvents and rejects malformed records", () => {
  assert.deepEqual(parsePersistedActivityEvent(validEvent), validEvent);
  assert.equal(parsePersistedActivityEvent({ ...validEvent, type: "secret_logged" }), null);
  assert.equal(parsePersistedActivityEvent({ ...validEvent, analysisId: null }), null);
  assert.equal(parsePersistedActivityEvent({ ...validEvent, details: { rawProviderPayload: {} } }), null);
});

test("only claimable approved workflow states can execute", () => {
  assert.equal(canClaimActionExecution({ status: "proposed", executionStatus: null, executionStartedAt: null }, "approve"), true);
  assert.equal(canClaimActionExecution({ status: "approved", executionStatus: "pending", executionStartedAt: null }, "retry_execution"), true);
  assert.equal(canClaimActionExecution({ status: "edited", executionStatus: null, executionStartedAt: null }, "retry_execution"), false);
  assert.equal(canClaimActionExecution({ status: "cancelled", executionStatus: null, executionStartedAt: null }, "retry_execution"), false);
});

test("successful execution cannot be claimed twice", () => {
  assert.equal(canClaimActionExecution({ status: "approved", executionStatus: "succeeded", executionStartedAt: validEvent.createdAt }, "retry_execution"), false);
});

test("email delivery is redirected with a stable idempotency key", () => {
  const input = {
    actionId: validEvent.id,
    testRecipient: "developer@example.com",
    subject: "Customer follow-up",
    body: "Approved draft body",
  };
  const first = buildTestEmailRequest(input);
  const retry = buildTestEmailRequest(input);

  assert.equal(first.to, "developer@example.com");
  assert.match(first.subject, /^\[Morrow Test\]/);
  assert.equal(first.idempotencyKey, retry.idempotencyKey);
});

test("failed and indeterminate execution results remain explicit", () => {
  assert.equal(EmailExecutionResultSchema.safeParse({ status: "failed", executionMode: "resend", failureCategory: "provider_rejected" }).success, true);
  assert.equal(EmailExecutionResultSchema.safeParse({ status: "indeterminate", executionMode: "resend", failureCategory: "outcome_unknown" }).success, true);
  assert.equal(EmailExecutionResultSchema.safeParse({ status: "failed", executionMode: "resend", failureCategory: "raw_provider_error" }).success, false);
});
