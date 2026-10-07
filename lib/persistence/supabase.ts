import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { WorkspaceEnquiry } from "@/lib/mock-workspace";
import { LeadAnalysisSchema, parsePersistedAnalysis, type LeadAnalysis } from "@/lib/lead-analysis-schema";

export class PersistenceConfigurationError extends Error {
  constructor() {
    super("Supabase persistence is not configured.");
    this.name = "PersistenceConfigurationError";
  }
}

export class PersistenceError extends Error {
  constructor() {
    super("The persistence operation failed.");
    this.name = "PersistenceError";
  }
}

type SupabaseOperationError = {
  code: string;
  message: string;
  details: string;
  hint: string;
};

// Log only PostgREST diagnostics, never the request or the data sent to the database.
function logDatabaseError(operation: string, error: SupabaseOperationError) {
  console.error("Supabase persistence operation failed.", {
    operation,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

function createServerClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !secretKey) {
    throw new PersistenceConfigurationError();
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new Error("Invalid Supabase URL protocol.");
    }
  } catch {
    throw new PersistenceConfigurationError();
  }

  // The privileged key stays in this server-only module; client components never connect to Postgres.
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// This function owns the fixture Enquiry upsert and appends only validated Analysis records.
export async function saveValidatedAnalysis(enquiry: WorkspaceEnquiry, analysis: LeadAnalysis): Promise<void> {
  const validatedAnalysis = LeadAnalysisSchema.safeParse(analysis);
  if (!validatedAnalysis.success) {
    throw new PersistenceError();
  }

  const supabase = createServerClient();
  try {
    const { error } = await supabase.from("enquiries").upsert({
      id: enquiry.id,
      source: enquiry.source,
      company_name: enquiry.companyName,
      contact_name: enquiry.contactName,
      email: enquiry.email,
      original_text: enquiry.originalText,
      created_at: new Date(enquiry.receivedAtIso).toISOString(),
      status: enquiry.workflowStatus,
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) {
      logDatabaseError("upsert enquiry", error);
      throw new PersistenceError();
    }
  } catch {
    throw new PersistenceError();
  }

  try {
    const { error } = await supabase.from("analyses").insert({
      enquiry_id: enquiry.id,
      status: "validated",
      model_output_json: validatedAnalysis.data,
    });
    if (error) {
      logDatabaseError("insert analysis", error);
      throw new PersistenceError();
    }
  } catch {
    throw new PersistenceError();
  }
}

// This function owns restoring the latest analysis and rejects corrupt or obsolete stored JSON.
export async function getLatestAnalysis(enquiryId: string): Promise<LeadAnalysis | null> {
  const supabase = createServerClient();
  let analysisJson: unknown;

  try {
    const { data, error } = await supabase
      .from("analyses")
      .select("model_output_json")
      .eq("enquiry_id", enquiryId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      logDatabaseError("select latest analysis", error);
      throw new PersistenceError();
    }
    analysisJson = data?.model_output_json;
  } catch {
    throw new PersistenceError();
  }

  if (analysisJson === undefined) {
    return null;
  }

  const analysis = parsePersistedAnalysis(analysisJson);
  if (!analysis) {
    throw new PersistenceError();
  }

  return analysis;
}
