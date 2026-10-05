import { analyzeEnquiryText, AnalysisConfigurationError } from "@/lib/ai/analyze-enquiry";
import {
  AnalyzeEnquiryErrorSchema,
  AnalyzeEnquiryRequestSchema,
  AnalyzeEnquiryResponseSchema,
} from "@/lib/lead-analysis-schema";

function errorResponse(status: number, code: "invalid_request" | "missing_configuration" | "analysis_unavailable", message: string) {
  return Response.json(AnalyzeEnquiryErrorSchema.parse({ error: { code, message } }), { status });
}

export async function POST(request: Request) {
  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Send valid JSON containing the enquiry text.");
  }

  // Treat browser input as untrusted even though the page sends a typed object.
  const parsedRequest = AnalyzeEnquiryRequestSchema.safeParse(requestBody);
  if (!parsedRequest.success) {
    return errorResponse(400, "invalid_request", "Enquiry text must be non-empty and no longer than 12,000 characters.");
  }

  try {
    const analysis = await analyzeEnquiryText(parsedRequest.data.originalText);
    const response = AnalyzeEnquiryResponseSchema.safeParse({ analysis });

    if (!response.success) {
      console.error("Lead analysis failed response validation.", response.error);
      return errorResponse(502, "analysis_unavailable", "The analysis result could not be validated. Please try again.");
    }

    return Response.json(response.data);
  } catch (error) {
    if (error instanceof AnalysisConfigurationError) {
      return errorResponse(503, "missing_configuration", "AI analysis is not configured. Set OPENAI_API_KEY and OPENAI_MODEL on the server.");
    }

    const detail = error instanceof Error ? { name: error.name, message: error.message } : "Unknown provider error";
    console.error("Lead analysis provider request failed.", detail);
    return errorResponse(502, "analysis_unavailable", "AI analysis could not be completed. Please try again.");
  }
}