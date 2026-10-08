import { z } from "zod";
import { PersistedActivityEventSchema } from "./activity-event-schema.ts";
import { EmailExecutionModeSchema, ExecutionFailureCategorySchema, ExecutionStatusSchema } from "./execution-schema.ts";

const ActionIdSchema = z.string().uuid();
const EnquiryIdSchema = z.string().regex(/^ENQ-\d{4}$/);
const TimestampSchema = z.string().datetime({ offset: true });

export const DraftReplyPayloadSchema = z.object({
  recipientName: z.string().trim().min(1).max(200),
  to: z.string().email().max(320),
  tone: z.enum(["professional", "friendly", "concise"]),
  keyPoints: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(12000),
}).strict();

export const ActionStatusSchema = z.enum(["proposed", "edited", "approved", "cancelled"]);

export const PersistedActionSchema = z.object({
  id: ActionIdSchema,
  enquiryId: EnquiryIdSchema,
  analysisId: ActionIdSchema,
  type: z.literal("draft_reply"),
  status: ActionStatusSchema,
  payload: DraftReplyPayloadSchema,
  proposedAt: TimestampSchema,
  updatedAt: TimestampSchema,
  approvedByUserAt: TimestampSchema.nullable(),
  rejectedAt: TimestampSchema.nullable(),
  executionMode: EmailExecutionModeSchema.nullable(),
  executionStatus: ExecutionStatusSchema.nullable(),
  executionStartedAt: TimestampSchema.nullable(),
  providerMessageId: z.string().min(1).max(200).nullable(),
  executedAt: TimestampSchema.nullable(),
  errorMessage: ExecutionFailureCategorySchema.nullable(),
}).strict().superRefine((action, context) => {
  if ((action.status === "approved") !== (action.approvedByUserAt !== null)) {
    context.addIssue({ code: "custom", path: ["approvedByUserAt"], message: "Approval timestamp must match approved status." });
  }
  if ((action.status === "cancelled") !== (action.rejectedAt !== null)) {
    context.addIssue({ code: "custom", path: ["rejectedAt"], message: "Rejection timestamp must match cancelled status." });
  }
  if ((action.status === "approved") !== (action.executionStatus !== null)) {
    context.addIssue({ code: "custom", path: ["executionStatus"], message: "Only approved Actions have execution state." });
  }
  if ((action.status === "approved") !== (action.executionMode !== null)) {
    context.addIssue({ code: "custom", path: ["executionMode"], message: "Only approved Actions have an execution mode." });
  }
  if (action.status !== "approved" && (action.executionStartedAt || action.providerMessageId || action.executedAt || action.errorMessage)) {
    context.addIssue({ code: "custom", path: ["executionStatus"], message: "Unapproved Actions cannot contain execution results." });
  }
  if (action.executionStatus === "succeeded" && (
    !action.executionStartedAt
    || !action.executedAt
    || action.errorMessage
    || (action.executionMode === "demo" && action.providerMessageId !== null)
    || (action.executionMode === "resend" && !action.providerMessageId)
  )) {
    context.addIssue({ code: "custom", path: ["executionStatus"], message: "Successful execution requires its result fields." });
  }
  if (action.executionStatus === "failed" && (!action.executionStartedAt || !action.errorMessage || action.errorMessage === "outcome_unknown" || action.executedAt || action.providerMessageId)) {
    context.addIssue({ code: "custom", path: ["executionStatus"], message: "Failed execution requires a safe failure category." });
  }
  if (action.executionStatus === "failed" && action.executionMode !== "resend") {
    context.addIssue({ code: "custom", path: ["executionMode"], message: "Only Resend execution can have provider failures." });
  }
  if (action.executionStatus === "pending" && (action.executedAt || action.providerMessageId || (action.errorMessage && action.errorMessage !== "outcome_unknown"))) {
    context.addIssue({ code: "custom", path: ["executionStatus"], message: "Pending execution cannot have a delivery result." });
  }
});

export const UpdateActionRequestSchema = z.object({
  enquiryId: EnquiryIdSchema,
  actionId: ActionIdSchema,
  operation: z.enum(["save_edit", "approve", "cancel", "retry_execution"]),
  payload: DraftReplyPayloadSchema,
}).strict();

export const ActionResponseSchema = z.object({
  action: PersistedActionSchema,
  events: z.array(PersistedActivityEventSchema),
}).strict();

export const ActionErrorSchema = z.object({
  error: z.object({
    code: z.enum(["invalid_request", "invalid_transition", "persistence_unavailable"]),
    message: z.string(),
  }).strict(),
}).strict();

export type DraftReplyPayload = z.infer<typeof DraftReplyPayloadSchema>;
export type PersistedAction = z.infer<typeof PersistedActionSchema>;
export type ActionOperation = z.infer<typeof UpdateActionRequestSchema>["operation"];

export function parsePersistedAction(value: unknown): PersistedAction | null {
  const parsed = PersistedActionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function transitionActionStatus(
  current: PersistedAction["status"],
  operation: ActionOperation,
): PersistedAction["status"] | null {
  if (current !== "proposed" && current !== "edited") return null;
  if (operation === "save_edit") return "edited";
  if (operation === "approve") return "approved";
  return operation === "cancel" ? "cancelled" : null;
}
