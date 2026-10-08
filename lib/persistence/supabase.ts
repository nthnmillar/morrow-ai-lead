import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  DraftReplyPayloadSchema,
  parsePersistedAction,
  PersistedActionSchema,
  transitionActionStatus,
  type ActionOperation,
  type DraftReplyPayload,
  type PersistedAction,
} from "@/lib/action-schema";
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

type StoredActionRow = {
  id: unknown;
  enquiry_id: unknown;
  analysis_id: unknown;
  type: unknown;
  status: unknown;
  payload: unknown;
  proposed_at: unknown;
  updated_at: unknown;
  approved_by_user_at: unknown;
  rejected_at: unknown;
  executed_at: unknown;
  error_message: unknown;
};

function parseActionRow(row: StoredActionRow): PersistedAction | null {
  return parsePersistedAction({
    id: row.id,
    enquiryId: row.enquiry_id,
    analysisId: row.analysis_id,
    type: row.type,
    status: row.status,
    payload: row.payload,
    proposedAt: row.proposed_at,
    updatedAt: row.updated_at,
    approvedByUserAt: row.approved_by_user_at,
    rejectedAt: row.rejected_at,
    executedAt: row.executed_at,
    errorMessage: row.error_message,
  });
}

const actionColumns = "id,enquiry_id,analysis_id,type,status,payload,proposed_at,updated_at,approved_by_user_at,rejected_at,executed_at,error_message";

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
export async function saveValidatedAnalysis(enquiry: WorkspaceEnquiry, analysis: LeadAnalysis): Promise<PersistedAction> {
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

  let analysisId: string;
  try {
    const { data, error } = await supabase.from("analyses").insert({
      enquiry_id: enquiry.id,
      status: "validated",
      model_output_json: validatedAnalysis.data,
    }).select("id").single();
    if (error) {
      logDatabaseError("insert analysis", error);
      throw new PersistenceError();
    }
    analysisId = data.id;
  } catch {
    throw new PersistenceError();
  }

  const analysisKeyPoints = validatedAnalysis.data.missingInformation
    .map(({ question }) => question.trim().slice(0, 500))
    .filter(Boolean)
    .slice(0, 20);
  const actionPayload = DraftReplyPayloadSchema.safeParse({
    recipientName: enquiry.contactName,
    to: enquiry.email,
    tone: "professional",
    keyPoints: analysisKeyPoints.length > 0
      ? analysisKeyPoints
      : [validatedAnalysis.data.recommendedNextStep.trim().slice(0, 500) || enquiry.recommendedNextAction],
    subject: enquiry.proposedAction.subject,
    body: enquiry.proposedAction.body,
  });
  if (!actionPayload.success) throw new PersistenceError();

  try {
    const { data, error } = await supabase.from("actions").insert({
      enquiry_id: enquiry.id,
      analysis_id: analysisId,
      type: "draft_reply",
      status: "proposed",
      payload: actionPayload.data,
    }).select(actionColumns).single();
    if (error) {
      logDatabaseError("insert action", error);
      throw new PersistenceError();
    }
    const action = parseActionRow(data);
    if (!action || action.analysisId !== analysisId || action.enquiryId !== enquiry.id) throw new PersistenceError();
    return action;
  } catch {
    throw new PersistenceError();
  }
}

// Restores the latest analysis and only its associated action; page loads never create actions.
export async function getLatestAnalysisState(enquiryId: string): Promise<{
  analysis: LeadAnalysis;
  action: PersistedAction | null;
} | null> {
  const supabase = createServerClient();
  let analysisJson: unknown;
  let analysisId: string;

  try {
    const { data, error } = await supabase
      .from("analyses")
      .select("id,model_output_json")
      .eq("enquiry_id", enquiryId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      logDatabaseError("select latest analysis", error);
      throw new PersistenceError();
    }
    if (!data) return null;
    analysisId = data.id;
    analysisJson = data.model_output_json;
  } catch {
    throw new PersistenceError();
  }

  const analysis = parsePersistedAnalysis(analysisJson);
  if (!analysis) {
    throw new PersistenceError();
  }

  try {
    const { data, error } = await supabase
      .from("actions")
      .select(actionColumns)
      .eq("analysis_id", analysisId)
      .order("proposed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      logDatabaseError("select latest action", error);
      throw new PersistenceError();
    }
    const action = data ? parseActionRow(data) : null;
    if (data && (!action || action.analysisId !== analysisId || action.enquiryId !== enquiryId)) {
      throw new PersistenceError();
    }
    return { analysis, action };
  } catch {
    throw new PersistenceError();
  }
}

export async function updatePersistedAction(input: {
  enquiryId: string;
  actionId: string;
  operation: ActionOperation;
  payload: DraftReplyPayload;
}): Promise<PersistedAction | null> {
  const payload = DraftReplyPayloadSchema.safeParse(input.payload);
  if (!payload.success) throw new PersistenceError();
  const supabase = createServerClient();

  try {
    const { data: stored, error: readError } = await supabase
      .from("actions")
      .select(actionColumns)
      .eq("id", input.actionId)
      .eq("enquiry_id", input.enquiryId)
      .maybeSingle();
    if (readError) {
      logDatabaseError("select action for update", readError);
      throw new PersistenceError();
    }

    const current = stored ? parseActionRow(stored) : null;
    if (!current) return null;
    const nextStatus = transitionActionStatus(current.status, input.operation);
    if (!nextStatus) return null;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("actions")
      .update({
        payload: payload.data,
        status: nextStatus,
        updated_at: now,
        approved_by_user_at: nextStatus === "approved" ? now : null,
        rejected_at: nextStatus === "cancelled" ? now : null,
      })
      .eq("id", input.actionId)
      .eq("enquiry_id", input.enquiryId)
      .eq("status", current.status)
      .select(actionColumns)
      .maybeSingle();
    if (error) {
      logDatabaseError("update action", error);
      throw new PersistenceError();
    }
    const action = data ? parseActionRow(data) : null;
    if (!action) return null;
    return PersistedActionSchema.parse(action);
  } catch (error) {
    if (error instanceof PersistenceError) throw error;
    throw new PersistenceError();
  }
}
