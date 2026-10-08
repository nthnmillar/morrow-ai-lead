import assert from "node:assert/strict";
import test from "node:test";
import {
  executeEmailByMode,
  executionSuccessMessage,
  resolveEmailExecutionMode,
  canClaimActionExecution,
} from "../lib/execution-schema.ts";
import { parsePersistedActivityEvent } from "../lib/activity-event-schema.ts";
import {
  belongsToDemoSession,
  filterForDemoSession,
  parseDemoSessionId,
} from "../lib/demo-session.ts";

const sessionA = "11111111-1111-4111-8111-111111111111";
const sessionB = "22222222-2222-4222-8222-222222222222";

test("demo mode succeeds without invoking Resend and uses truthful success copy", async () => {
  let resendCalls = 0;
  const result = await executeEmailByMode("demo", async () => {
    resendCalls += 1;
    return { status: "succeeded", executionMode: "resend", providerMessageId: "provider-id" };
  });

  assert.deepEqual(result, { status: "succeeded", executionMode: "demo", providerMessageId: null });
  assert.equal(resendCalls, 0);
  assert.equal(executionSuccessMessage(result.executionMode), "Email simulated successfully");
  assert.equal(canClaimActionExecution({ status: "approved", executionStatus: "succeeded", executionStartedAt: "2026-10-08T10:00:00.000Z" }, "retry_execution"), false);

  const simulatedEvent = parsePersistedActivityEvent({
    id: "33333333-3333-4333-8333-333333333333",
    enquiryId: "ENQ-2044",
    analysisId: "44444444-4444-4444-8444-444444444444",
    actionId: "55555555-5555-4555-8555-555555555555",
    type: "email_simulated",
    summary: "Email simulated successfully",
    details: { executionStatus: "succeeded", executionMode: "demo" },
    createdAt: "2026-10-08T10:00:00.000Z",
  });
  assert.equal(simulatedEvent?.type, "email_simulated");
});

test("resend mode keeps the real adapter path", async () => {
  let resendCalls = 0;
  const result = await executeEmailByMode("resend", async () => {
    resendCalls += 1;
    return { status: "succeeded", executionMode: "resend", providerMessageId: "provider-id" };
  });

  assert.equal(resendCalls, 1);
  assert.equal(result.executionMode, "resend");
});

test("missing and invalid execution configuration fail safely to demo mode", () => {
  assert.equal(resolveEmailExecutionMode(undefined), "demo");
  assert.equal(resolveEmailExecutionMode("unexpected"), "demo");
  assert.equal(resolveEmailExecutionMode("resend"), "resend");
});

test("same enquiry records remain isolated by anonymous demo session", () => {
  const analyses = [
    { id: "analysis-a", enquiryId: "ENQ-2044", demoSessionId: sessionA },
    { id: "analysis-b", enquiryId: "ENQ-2044", demoSessionId: sessionB },
  ];

  assert.deepEqual(filterForDemoSession(analyses, sessionA), [analyses[0]]);
  assert.deepEqual(filterForDemoSession(analyses, sessionB), [analyses[1]]);
  assert.equal(belongsToDemoSession({ demoSessionId: sessionB }, sessionA), false);
});

test("action ownership and activity visibility use the current server session", () => {
  const actionB = { id: "action-b", demoSessionId: sessionB };
  const events = [
    { id: "event-a", demoSessionId: sessionA },
    { id: "event-b", demoSessionId: sessionB },
  ];

  assert.equal(belongsToDemoSession(actionB, sessionA), false);
  assert.deepEqual(filterForDemoSession(events, sessionA), [events[0]]);
  assert.equal(parseDemoSessionId("client-supplied-name"), null);
});
