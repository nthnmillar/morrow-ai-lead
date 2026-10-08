import { z } from "zod";
import { EmailExecutionModeSchema, ExecutionFailureCategorySchema, ExecutionStatusSchema } from "./execution-schema.ts";

export const ActivityEventTypeSchema = z.enum([
  "validated",
  "action_proposed",
  "edited",
  "approved",
  "cancelled",
  "email_sent",
  "email_simulated",
  "email_failed",
]);

export const ActivityEventDetailsSchema = z.object({
  executionStatus: ExecutionStatusSchema.optional(),
  executionMode: EmailExecutionModeSchema.optional(),
  failureCategory: ExecutionFailureCategorySchema.optional(),
}).strict();

export const PersistedActivityEventSchema = z.object({
  id: z.string().uuid(),
  enquiryId: z.string().regex(/^ENQ-\d{4}$/),
  analysisId: z.string().uuid().nullable(),
  actionId: z.string().uuid().nullable(),
  type: ActivityEventTypeSchema,
  summary: z.string().trim().min(1).max(500),
  details: ActivityEventDetailsSchema,
  createdAt: z.string().datetime({ offset: true }),
}).strict().superRefine((event, context) => {
  if (event.type === "validated" && !event.analysisId) {
    context.addIssue({ code: "custom", path: ["analysisId"], message: "Analysis events require an Analysis ID." });
  }
  if (event.type !== "validated" && !event.actionId) {
    context.addIssue({ code: "custom", path: ["actionId"], message: "Action events require an Action ID." });
  }
  if (event.type === "email_sent" && (event.details.executionStatus !== "succeeded" || event.details.failureCategory)) {
    context.addIssue({ code: "custom", path: ["details"], message: "Sent events require a successful execution result." });
  }
  if (event.type === "email_sent" && event.details.executionMode && event.details.executionMode !== "resend") {
    context.addIssue({ code: "custom", path: ["details"], message: "Sent events must represent Resend delivery." });
  }
  if (event.type === "email_simulated" && (event.details.executionStatus !== "succeeded" || event.details.executionMode !== "demo" || event.details.failureCategory)) {
    context.addIssue({ code: "custom", path: ["details"], message: "Simulated events require a successful demo execution." });
  }
  if (event.type === "email_failed" && (!event.details.failureCategory || !["failed", "pending"].includes(event.details.executionStatus ?? ""))) {
    context.addIssue({ code: "custom", path: ["details"], message: "Failed events require a safe execution failure result." });
  }
  if (event.type === "email_failed" && event.details.executionMode && event.details.executionMode !== "resend") {
    context.addIssue({ code: "custom", path: ["details"], message: "Provider failure events must represent Resend execution." });
  }
  if (event.type === "approved" && (event.details.executionStatus !== "pending" || event.details.failureCategory)) {
    context.addIssue({ code: "custom", path: ["details"], message: "Approval events require pending execution." });
  }
  if (!event.type.startsWith("email_") && Object.keys(event.details).length > 0 && event.type !== "approved") {
    context.addIssue({ code: "custom", path: ["details"], message: "This event type does not accept execution details." });
  }
});

export type PersistedActivityEvent = z.infer<typeof PersistedActivityEventSchema>;

export function parsePersistedActivityEvent(value: unknown): PersistedActivityEvent | null {
  const parsed = PersistedActivityEventSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
