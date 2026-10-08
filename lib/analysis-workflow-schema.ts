import { z } from "zod";
import { PersistedActionSchema } from "@/lib/action-schema";
import { LeadAnalysisSchema } from "@/lib/lead-analysis-schema";

export const AnalyzeEnquiryWorkflowResponseSchema = z.object({
  analysis: LeadAnalysisSchema,
  action: PersistedActionSchema,
}).strict();
