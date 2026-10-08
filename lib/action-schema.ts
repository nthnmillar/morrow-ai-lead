import { z } from "zod";

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
  executedAt: TimestampSchema.nullable(),
  errorMessage: z.string().nullable(),
}).strict().superRefine((action, context) => {
  if ((action.status === "approved") !== (action.approvedByUserAt !== null)) {
    context.addIssue({ code: "custom", path: ["approvedByUserAt"], message: "Approval timestamp must match approved status." });
  }
  if ((action.status === "cancelled") !== (action.rejectedAt !== null)) {
    context.addIssue({ code: "custom", path: ["rejectedAt"], message: "Rejection timestamp must match cancelled status." });
  }
});

export const UpdateActionRequestSchema = z.object({
  enquiryId: EnquiryIdSchema,
  actionId: ActionIdSchema,
  operation: z.enum(["save_edit", "approve", "cancel"]),
  payload: DraftReplyPayloadSchema,
}).strict();

export const ActionResponseSchema = z.object({ action: PersistedActionSchema }).strict();

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
  return operation === "approve" ? "approved" : "cancelled";
}
