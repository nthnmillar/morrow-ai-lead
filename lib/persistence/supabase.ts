import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  DraftReplyPayloadSchema,
  parsePersistedAction,
  type ActionOperation,
  type DraftReplyPayload,
  type PersistedAction,
} from "@/lib/action-schema";
import { parsePersistedActivityEvent, type PersistedActivityEvent } from "@/lib/activity-event-schema";
import { EmailExecutionResultSchema, type EmailExecutionMode, type EmailExecutionResult } from "@/lib/execution-schema";
import type { DemoSessionId } from "@/lib/demo-session";
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
  execution_mode: unknown;
  execution_status: unknown;
  execution_started_at: unknown;
  provider_message_id: unknown;
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
    executionMode: row.execution_mode,
    executionStatus: row.execution_status,
    executionStartedAt: row.execution_started_at,
    providerMessageId: row.provider_message_id,
    executedAt: row.executed_at,
    errorMessage: row.error_message,
  });
}

type StoredActivityEventRow = {
  id: unknown;
  enquiry_id: unknown;
  analysis_id: unknown;
  action_id: unknown;
  type: unknown;
  summary: unknown;
  details: unknown;
  created_at: unknown;
};

function parseActivityEventRow(row: StoredActivityEventRow): PersistedActivityEvent | null {
  return parsePersistedActivityEvent({
    id: row.id,
    enquiryId: row.enquiry_id,
    analysisId: row.analysis_id,
    actionId: row.action_id,
    type: row.type,
    summary: row.summary,
    details: row.details,
    createdAt: row.created_at,
  });
}

const actionColumns = "id,enquiry_id,analysis_id,type,status,payload,proposed_at,updated_at,approved_by_user_at,rejected_at,execution_mode,execution_status,execution_started_at,provider_message_id,executed_at,error_message";
const activityColumns = "id,enquiry_id,analysis_id,action_id,type,summary,details,created_at";

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
export async function saveValidatedAnalysis(demoSessionId: DemoSessionId, enquiry: WorkspaceEnquiry, analysis: LeadAnalysis): Promise<{
  action: PersistedAction;
  events: PersistedActivityEvent[];
}> {
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
      demo_session_id: demoSessionId,
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
      demo_session_id: demoSessionId,
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

    const { data: eventRows, error: eventError } = await supabase.from("activity_events").insert([
      {
        demo_session_id: demoSessionId,
        enquiry_id: enquiry.id,
        analysis_id: analysisId,
        action_id: null,
        type: "validated",
        summary: "AI analysis completed and passed validation.",
        details: {},
      },
      {
        demo_session_id: demoSessionId,
        enquiry_id: enquiry.id,
        analysis_id: analysisId,
        action_id: action.id,
        type: "action_proposed",
        summary: "A draft reply was saved for human review.",
        details: {},
      },
    ]).select(activityColumns);
    if (eventError) {
      logDatabaseError("insert analysis activity", eventError);
      throw new PersistenceError();
    }
    const events = (eventRows ?? []).map(parseActivityEventRow);
    if (events.some((event) => !event)) throw new PersistenceError();
    return { action, events: events as PersistedActivityEvent[] };
  } catch {
    throw new PersistenceError();
  }
}

// Restores the latest analysis and only its associated action; page loads never create actions.
export async function getLatestAnalysisState(demoSessionId: DemoSessionId, enquiryId: string): Promise<{
  analysis: LeadAnalysis;
  action: PersistedAction | null;
  events: PersistedActivityEvent[];
} | null> {
  const supabase = createServerClient();
  let analysisJson: unknown;
  let analysisId: string;

  try {
    const { data, error } = await supabase
      .from("analyses")
      .select("id,model_output_json")
      .eq("demo_session_id", demoSessionId)
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
      .eq("demo_session_id", demoSessionId)
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
    const events = await getPersistedActivityEvents(demoSessionId, enquiryId);
    return { analysis, action, events };
  } catch {
    throw new PersistenceError();
  }
}

async function getPersistedAction(demoSessionId: DemoSessionId, actionId: string, enquiryId: string): Promise<PersistedAction | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("actions")
    .select(actionColumns)
    .eq("demo_session_id", demoSessionId)
    .eq("id", actionId)
    .eq("enquiry_id", enquiryId)
    .maybeSingle();
  if (error) {
    logDatabaseError("select action", error);
    throw new PersistenceError();
  }
  const action = data ? parseActionRow(data) : null;
  if (data && !action) throw new PersistenceError();
  return action;
}

export async function getPersistedActivityEvents(demoSessionId: DemoSessionId, enquiryId?: string): Promise<PersistedActivityEvent[]> {
  const supabase = createServerClient();
  let query = supabase.from("activity_events").select(activityColumns).eq("demo_session_id", demoSessionId);
  if (enquiryId) query = query.eq("enquiry_id", enquiryId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
  if (error) {
    logDatabaseError("select activity events", error);
    throw new PersistenceError();
  }
  const events = (data ?? []).map(parseActivityEventRow);
  if (events.some((event) => !event)) throw new PersistenceError();
  return events as PersistedActivityEvent[];
}

async function getActionState(demoSessionId: DemoSessionId, actionId: string, enquiryId: string) {
  const [action, events] = await Promise.all([
    getPersistedAction(demoSessionId, actionId, enquiryId),
    getPersistedActivityEvents(demoSessionId, enquiryId),
  ]);
  return action ? { action, events } : null;
}

export async function updatePersistedAction(input: {
  demoSessionId: DemoSessionId;
  enquiryId: string;
  actionId: string;
  operation: Extract<ActionOperation, "save_edit" | "cancel">;
  payload: DraftReplyPayload;
}): Promise<{ action: PersistedAction; events: PersistedActivityEvent[] } | null> {
  const payload = DraftReplyPayloadSchema.safeParse(input.payload);
  if (!payload.success) throw new PersistenceError();
  const supabase = createServerClient();

  try {
    const { data, error } = await supabase.rpc("record_action_review", {
      p_demo_session_id: input.demoSessionId,
      p_action_id: input.actionId,
      p_enquiry_id: input.enquiryId,
      p_operation: input.operation,
      p_payload: payload.data,
    });
    if (error) {
      logDatabaseError("record action review", error);
      throw new PersistenceError();
    }
    return data === true ? await getActionState(input.demoSessionId, input.actionId, input.enquiryId) : null;
  } catch (error) {
    if (error instanceof PersistenceError) throw error;
    throw new PersistenceError();
  }
}

export async function claimPersistedActionExecution(input: {
  demoSessionId: DemoSessionId;
  enquiryId: string;
  actionId: string;
  operation: Extract<ActionOperation, "approve" | "retry_execution">;
  payload: DraftReplyPayload;
  executionMode: EmailExecutionMode;
}): Promise<{ action: PersistedAction; events: PersistedActivityEvent[]; claimed: boolean } | null> {
  const payload = DraftReplyPayloadSchema.safeParse(input.payload);
  if (!payload.success) throw new PersistenceError();
  const supabase = createServerClient();
  try {
    const { data, error } = await supabase.rpc("claim_action_execution", {
      p_demo_session_id: input.demoSessionId,
      p_action_id: input.actionId,
      p_enquiry_id: input.enquiryId,
      p_operation: input.operation,
      p_payload: payload.data,
      p_execution_mode: input.executionMode,
    });
    if (error) {
      logDatabaseError("claim action execution", error);
      throw new PersistenceError();
    }
    const state = await getActionState(input.demoSessionId, input.actionId, input.enquiryId);
    return state ? { ...state, claimed: data === true } : null;
  } catch (error) {
    if (error instanceof PersistenceError) throw error;
    throw new PersistenceError();
  }
}

export async function finalizePersistedActionExecution(
  demoSessionId: DemoSessionId,
  action: PersistedAction,
  result: EmailExecutionResult,
): Promise<{ action: PersistedAction; events: PersistedActivityEvent[] }> {
  const validatedResult = EmailExecutionResultSchema.parse(result);
  if (!action.executionStartedAt || action.executionMode !== validatedResult.executionMode) throw new PersistenceError();
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("finalize_action_execution", {
    p_demo_session_id: demoSessionId,
    p_action_id: action.id,
    p_enquiry_id: action.enquiryId,
    p_execution_started_at: action.executionStartedAt,
    p_execution_mode: validatedResult.executionMode,
    p_result: validatedResult.status,
    p_provider_message_id: validatedResult.status === "succeeded" ? validatedResult.providerMessageId : null,
    p_failure_category: validatedResult.status === "succeeded" ? null : validatedResult.failureCategory,
  });
  if (error) {
    logDatabaseError("finalize action execution", error);
    throw new PersistenceError();
  }
  const state = data === true ? await getActionState(demoSessionId, action.id, action.enquiryId) : null;
  if (!state) throw new PersistenceError();
  return state;
}
