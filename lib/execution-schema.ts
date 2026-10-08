import { z } from "zod";

export const ExecutionStatusSchema = z.enum(["pending", "succeeded", "failed"]);
export const EmailExecutionModeSchema = z.enum(["demo", "resend"]);
export const ExecutionFailureCategorySchema = z.enum([
  "configuration_missing",
  "provider_rejected",
  "outcome_unknown",
]);

export const EmailExecutionResultSchema = z.union([
  z.object({ status: z.literal("succeeded"), executionMode: z.literal("demo"), providerMessageId: z.null() }).strict(),
  z.object({ status: z.literal("succeeded"), executionMode: z.literal("resend"), providerMessageId: z.string().min(1).max(200) }).strict(),
  z.object({ status: z.literal("failed"), executionMode: z.literal("resend"), failureCategory: ExecutionFailureCategorySchema.exclude(["outcome_unknown"]) }).strict(),
  z.object({ status: z.literal("indeterminate"), executionMode: z.literal("resend"), failureCategory: z.literal("outcome_unknown") }).strict(),
]);

export type EmailExecutionResult = z.infer<typeof EmailExecutionResultSchema>;
export type EmailExecutionMode = z.infer<typeof EmailExecutionModeSchema>;

export function resolveEmailExecutionMode(value: unknown): EmailExecutionMode {
  const parsed = EmailExecutionModeSchema.safeParse(value);
  return parsed.success ? parsed.data : "demo";
}

export async function executeEmailByMode(
  mode: EmailExecutionMode,
  sendWithResend: () => Promise<EmailExecutionResult>,
): Promise<EmailExecutionResult> {
  if (mode === "demo") {
    return EmailExecutionResultSchema.parse({ status: "succeeded", executionMode: "demo", providerMessageId: null });
  }
  const result = EmailExecutionResultSchema.parse(await sendWithResend());
  if (result.executionMode !== "resend") throw new Error("Resend adapter returned the wrong execution mode.");
  return result;
}

export function executionSuccessMessage(mode: EmailExecutionMode) {
  return mode === "demo" ? "Email simulated successfully" : "Email sent to the configured test inbox";
}

const TestEmailRequestSchema = z.object({
  from: z.literal("Morrow Portfolio <onboarding@resend.dev>"),
  to: z.string().email(),
  subject: z.string().startsWith("[Morrow Test] "),
  text: z.string().startsWith("MORROW PORTFOLIO TEST"),
  idempotencyKey: z.string().min(1).max(256),
}).strict();

export function buildTestEmailRequest(input: {
  actionId: string;
  testRecipient: string;
  subject: string;
  body: string;
}) {
  return TestEmailRequestSchema.parse({
    from: "Morrow Portfolio <onboarding@resend.dev>",
    to: input.testRecipient,
    subject: `[Morrow Test] ${input.subject}`,
    text: `MORROW PORTFOLIO TEST — controlled delivery to the configured test inbox only.\n\n${input.body}`,
    idempotencyKey: `morrow-draft-reply/${input.actionId}`,
  });
}

export function canClaimActionExecution(
  action: { status: string; executionStatus: string | null; executionStartedAt: string | null },
  operation: "approve" | "retry_execution",
) {
  if (operation === "approve") return action.status === "proposed" || action.status === "edited";
  return action.status === "approved"
    && (action.executionStatus === "failed"
      || (action.executionStatus === "pending" && action.executionStartedAt === null));
}
