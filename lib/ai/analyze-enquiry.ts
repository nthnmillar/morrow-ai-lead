import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { LeadAnalysisSchema, type LeadAnalysis } from "@/lib/lead-analysis-schema";

export class AnalysisConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisConfigurationError";
  }
}

const analysisInstructions = [
  "You analyze inbound enquiries for a generic B2B digital services studio.",
  "Extract only facts supported by the supplied enquiry. Never invent a company, contact, email, budget, timeline, or requirement.",
  "Use null for unknown company/contact/email, budget bounds/currency, launch date, or urgency. Use an empty array when no requirements or missing questions can be supported.",
  "Classify project type using the closest allowed category; use other when none fits.",
  "Score commercial fit from 0 to 100 using clarity, intent, fit signals, budget/timeline information, and completeness. Keep priority consistent with the score and evidence.",
  "Write a concise qualification summary and one practical next step. Do not include tools, actions, or execution instructions.",
].join(" ");

export async function analyzeEnquiryText(originalText: string): Promise<LeadAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL?.trim();

  if (!apiKey) {
    throw new AnalysisConfigurationError("OPENAI_API_KEY is not configured.");
  }

  if (!model) {
    throw new AnalysisConfigurationError("OPENAI_MODEL is not configured.");
  }

  // This module is server-only so the credential never enters the browser bundle.
  const client = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 });
  const response = await client.responses.parse({
    model,
    input: [
      { role: "system", content: analysisInstructions },
      { role: "user", content: originalText },
    ],
    text: {
      format: zodTextFormat(LeadAnalysisSchema, "lead_analysis"),
    },
  });

  if (!response.output_parsed) {
    throw new Error(`Structured analysis was unavailable (response status: ${response.status}).`);
  }

  // Revalidate at the application boundary before this result can reach UI state.
  const validated = LeadAnalysisSchema.safeParse(response.output_parsed);
  if (!validated.success) {
    throw new Error("Structured analysis failed application validation.");
  }

  return validated.data;
}