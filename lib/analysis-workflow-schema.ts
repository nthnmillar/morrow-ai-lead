import { z } from "zod";
import { PersistedActionSchema } from "@/lib/action-schema";
import { PersistedActivityEventSchema } from "@/lib/activity-event-schema";
import { LeadAnalysisSchema } from "@/lib/lead-analysis-schema";

export const AnalyzeEnquiryWorkflowResponseSchema = z.object({
  analysis: LeadAnalysisSchema,
  action: PersistedActionSchema,
  events: z.array(PersistedActivityEventSchema),
}).strict();
