import { z } from "zod";

const PrioritySchema = z.enum(["low", "medium", "high"]);

// Strict objects reject provider-added fields; nullable values represent facts absent from source text.
export const LeadAnalysisSchema = z.object({
  companyName: z.string().nullable(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  projectType: z.string().nullable(),
  budgetRange: z.object({
    min: z.number().nullable(),
    max: z.number().nullable(),
    currency: z.enum(["USD", "CAD", "AUD", "NZD", "GBP", "EUR", "other"]).nullable(),
    statedText: z.string().nullable(),
  }).strict(),
  timeline: z.object({
    requestedLaunch: z.string().nullable(),
    urgency: PrioritySchema.nullable(),
  }).strict(),
  requirements: z.array(z.object({
    label: z.string(),
    value: z.string(),
  }).strict()),
  missingInformation: z.array(z.object({
    field: z.string(),
    question: z.string(),
    priority: PrioritySchema,
  }).strict()),
  leadScore: z.number().min(0).max(100),
  priority: PrioritySchema,
  qualificationSummary: z.string(),
  recommendedNextStep: z.string(),
}).strict();

// Structured Outputs require every key; nullable values represent facts absent from the source.
export const AnalyzeEnquiryRequestSchema = z.object({
  originalText: z.string().trim().min(1).max(12000),
}).strict();

export const AnalyzeEnquiryResponseSchema = z.object({
  analysis: LeadAnalysisSchema,
}).strict();

export const AnalyzeEnquiryErrorSchema = z.object({
  error: z.object({
    code: z.enum(["invalid_request", "missing_configuration", "analysis_unavailable"]),
    message: z.string(),
  }).strict(),
}).strict();

export type LeadAnalysis = z.infer<typeof LeadAnalysisSchema>;