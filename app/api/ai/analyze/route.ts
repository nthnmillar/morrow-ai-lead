import {
  analyzeEnquiryText,
  AnalysisConfigurationError,
  AnalysisOutputError,
} from "@/lib/ai/analyze-enquiry";
import { mockEnquiries } from "@/lib/mock-workspace";
import {
  AnalyzeEnquiryErrorSchema,
  AnalyzeEnquiryRequestSchema,
  LeadAnalysisSchema,
} from "@/lib/lead-analysis-schema";
import { AnalyzeEnquiryWorkflowResponseSchema } from "@/lib/analysis-workflow-schema";
import {
  PersistenceConfigurationError,
  PersistenceError,
  saveValidatedAnalysis,
} from "@/lib/persistence/supabase";
import { getDemoSessionId, DemoSessionError } from "@/lib/demo-session-server";

function errorResponse(
  status: number,
  code: "invalid_request" | "missing_configuration" | "analysis_unavailable" | "persistence_unavailable",
  message: string,
) {
  return Response.json(AnalyzeEnquiryErrorSchema.parse({ error: { code, message } }), { status });
}

export async function POST(request: Request) {
  let demoSessionId;
  try {
    demoSessionId = await getDemoSessionId();
  } catch (error) {
    if (error instanceof DemoSessionError) return errorResponse(400, "invalid_request", "Start a valid demo session and try again.");
    throw error;
  }

  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Send valid JSON containing the enquiry ID and text.");
  }

  // Treat browser input as untrusted even though the page validates it before sending.
  const parsedRequest = AnalyzeEnquiryRequestSchema.safeParse(requestBody);
  if (!parsedRequest.success) {
    return errorResponse(400, "invalid_request", "Provide a valid demo enquiry ID and text no longer than 12,000 characters.");
  }

  const enquiry = mockEnquiries.find((item) => item.id === parsedRequest.data.enquiryId);
  if (!enquiry || enquiry.originalText !== parsedRequest.data.originalText) {
    return errorResponse(400, "invalid_request", "The enquiry ID and source text do not match a current demo enquiry.");
  }

  try {
    const analysis = await analyzeEnquiryText(enquiry.originalText);
    const response = LeadAnalysisSchema.safeParse(analysis);

    if (!response.success) {
      console.error("Lead analysis failed response validation.", response.error);
      return errorResponse(502, "analysis_unavailable", "The analysis result could not be validated. Please try again.");
    }

    // The provider returns LeadAnalysis only after Zod validation; the persistence boundary validates it again.
    const saved = await saveValidatedAnalysis(demoSessionId, enquiry, response.data);

    return Response.json(AnalyzeEnquiryWorkflowResponseSchema.parse({ analysis: response.data, ...saved }));
  } catch (error) {
    if (error instanceof AnalysisConfigurationError) {
      return errorResponse(503, "missing_configuration", "AI analysis is not configured. Set GEMINI_API_KEY and GEMINI_MODEL on the server.");
    }

    if (error instanceof AnalysisOutputError) {
      console.error("Lead analysis failed structured output validation.", error.message);
      return errorResponse(502, "analysis_unavailable", "The analysis result could not be validated. Please try again.");
    }

    if (error instanceof PersistenceConfigurationError) {
      return errorResponse(503, "persistence_unavailable", "AI analysis completed, but saving is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY on the server.");
    }

    if (error instanceof PersistenceError) {
      console.error("Validated AI analysis could not be persisted.");
      return errorResponse(503, "persistence_unavailable", "AI analysis completed, but could not be saved. Please try again.");
    }

    // Keep provider diagnostics server-side while returning the stable API error contract.
    const detail = error instanceof Error ? { name: error.name, message: error.message } : "Unknown provider error";
    console.error("Lead analysis provider request failed.", detail);
    return errorResponse(502, "analysis_unavailable", "AI analysis could not be completed. Please try again.");
  }
}
