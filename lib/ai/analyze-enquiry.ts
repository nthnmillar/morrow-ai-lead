import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { LeadAnalysisSchema, type LeadAnalysis } from "@/lib/lead-analysis-schema";

export class AnalysisConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisConfigurationError";
  }
}

export class AnalysisOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisOutputError";
  }
}

const analysisInstructions = [
  "You analyze inbound enquiries for a generic B2B digital services studio.",
  "Extract only facts supported by the supplied enquiry. Never invent a company, contact, email, budget, timeline, or requirement.",
  "Use null for unknown company/contact/email, budget bounds/currency, launch date, or urgency. Use an empty array when no requirements or missing questions can be supported.",
  "Describe the project type as a concise phrase grounded in the enquiry; use null when it cannot be identified.",
  "Score commercial fit from 0 to 100 using clarity, intent, fit signals, budget/timeline information, and completeness. Keep priority consistent with the score and evidence.",
  "Write a concise qualification summary and one practical next step. Do not include tools, actions, or execution instructions.",
].join(" ");

// Derive Gemini's output contract from the same Zod schema used for application validation.
const analysisResponseSchema = z.toJSONSchema(LeadAnalysisSchema, { target: "draft-7" });
const maxProviderRetries = 2;

export async function analyzeEnquiryText(originalText: string): Promise<LeadAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL?.trim();

  if (!apiKey) {
    throw new AnalysisConfigurationError("GEMINI_API_KEY is not configured.");
  }

  if (!model) {
    throw new AnalysisConfigurationError("GEMINI_MODEL is not configured.");
  }

  // Keep the credential in this server-only provider boundary, outside client bundles.
  const client = new GoogleGenAI({ apiKey });
  let response: Awaited<ReturnType<typeof client.interactions.create>> | null = null;

  // Disable SDK retries so only explicitly classified transient HTTP failures are retried.
  for (let attempt = 1; attempt <= maxProviderRetries + 1; attempt += 1) {
    const requestStartedAt = performance.now();
    try {
      response = await client.interactions.create({
        model,
        system_instruction: analysisInstructions,
        input: originalText,
        generation_config: {
          thinking_level: "minimal",
        },
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: analysisResponseSchema,
        },
      }, { timeout: 30_000, maxRetries: 0 });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.info("Gemini request timing", {
          model,
          attempt,
          elapsedMs: Math.round(performance.now() - requestStartedAt),
        });
      }

      const isTransient = error instanceof ApiError
        && (error.status === 429 || [500, 502, 503, 504].includes(error.status));

      // Configuration, authentication, and request errors are not transient.
      if (!isTransient || attempt > maxProviderRetries) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** (attempt - 1))));
      continue;
    }

    if (process.env.NODE_ENV !== "production") {
      console.info("Gemini request timing", {
        model,
        attempt,
        elapsedMs: Math.round(performance.now() - requestStartedAt),
      });
    }
    break;
  }

  if (!response) {
    throw new Error("Gemini request did not complete.");
  }

  if (response.status !== "completed" || !response.output_text?.trim()) {
    throw new AnalysisOutputError("Gemini did not return structured analysis.");
  }

  let output: unknown;
  try {
    output = JSON.parse(response.output_text);
  } catch {
    throw new AnalysisOutputError("Gemini returned malformed structured analysis.");
  }

  // Structured output is still untrusted; revalidate it against the application schema.
  const validated = LeadAnalysisSchema.safeParse(output);
  if (!validated.success) {
    throw new AnalysisOutputError("Gemini structured analysis failed application validation.");
  }

  return validated.data;
}