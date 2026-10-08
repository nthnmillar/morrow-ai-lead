import "server-only";
import { Resend } from "resend";
import { z } from "zod";
import { PersistedActionSchema, type PersistedAction } from "@/lib/action-schema";
import { buildTestEmailRequest, EmailExecutionResultSchema, type EmailExecutionResult } from "@/lib/execution-schema";

const EmailConfigurationSchema = z.object({
  apiKey: z.string().trim().min(1),
  testRecipient: z.string().trim().email(),
}).strict();

// Sends only to the configured test inbox; the fictional payload recipient is never used for delivery.
export async function sendApprovedDraftToTestInbox(action: PersistedAction): Promise<EmailExecutionResult> {
  const validatedAction = PersistedActionSchema.safeParse(action);
  if (
    !validatedAction.success
    || validatedAction.data.status !== "approved"
    || validatedAction.data.executionMode !== "resend"
    || validatedAction.data.executionStatus !== "pending"
    || !validatedAction.data.executionStartedAt
  ) {
    return EmailExecutionResultSchema.parse({ status: "failed", executionMode: "resend", failureCategory: "provider_rejected" });
  }

  const configuration = EmailConfigurationSchema.safeParse({
    apiKey: process.env.RESEND_API_KEY,
    testRecipient: process.env.TEST_EMAIL_RECIPIENT,
  });
  if (!configuration.success) {
    return EmailExecutionResultSchema.parse({ status: "failed", executionMode: "resend", failureCategory: "configuration_missing" });
  }

  const startedAt = Date.now();
  try {
    const resend = new Resend(configuration.data.apiKey);
    const email = buildTestEmailRequest({
      actionId: validatedAction.data.id,
      testRecipient: configuration.data.testRecipient,
      subject: validatedAction.data.payload.subject,
      body: validatedAction.data.payload.body,
    });
    const { data, error } = await resend.emails.send({
      from: email.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
    }, {
      idempotencyKey: email.idempotencyKey,
      signal: AbortSignal.timeout(30_000),
    });

    if (error) {
      console.error("Resend rejected controlled email execution.", {
        actionId: validatedAction.data.id,
        category: error.name,
        statusCode: error.statusCode,
        elapsedMs: Date.now() - startedAt,
      });
      return EmailExecutionResultSchema.parse({ status: "failed", executionMode: "resend", failureCategory: "provider_rejected" });
    }

    return EmailExecutionResultSchema.parse({ status: "succeeded", executionMode: "resend", providerMessageId: data.id });
  } catch (error) {
    console.error("Resend execution outcome could not be confirmed.", {
      actionId: validatedAction.data.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
      elapsedMs: Date.now() - startedAt,
    });
    return EmailExecutionResultSchema.parse({ status: "indeterminate", executionMode: "resend", failureCategory: "outcome_unknown" });
  }
}
