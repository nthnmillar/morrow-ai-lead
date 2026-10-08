import { mockEnquiries } from "@/lib/mock-workspace";
import {
  ActionErrorSchema,
  ActionResponseSchema,
  UpdateActionRequestSchema,
} from "@/lib/action-schema";
import {
  claimPersistedActionExecution,
  finalizePersistedActionExecution,
  PersistenceConfigurationError,
  PersistenceError,
  updatePersistedAction,
} from "@/lib/persistence/supabase";
import { sendApprovedDraftToTestInbox } from "@/lib/execution/send-test-email";
import { getDemoSessionId, DemoSessionError } from "@/lib/demo-session-server";
import { executeEmailByMode, resolveEmailExecutionMode } from "@/lib/execution-schema";

function errorResponse(
  status: number,
  code: "invalid_request" | "invalid_transition" | "persistence_unavailable",
  message: string,
) {
  return Response.json(ActionErrorSchema.parse({ error: { code, message } }), { status });
}

export async function PATCH(request: Request) {
  let demoSessionId;
  try {
    demoSessionId = await getDemoSessionId();
  } catch (error) {
    if (error instanceof DemoSessionError) return errorResponse(400, "invalid_request", "Start a valid demo session and try again.");
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Send a valid Action update.");
  }

  const input = UpdateActionRequestSchema.safeParse(body);
  if (!input.success || !mockEnquiries.some(({ id }) => id === input.data.enquiryId)) {
    return errorResponse(400, "invalid_request", "Send a valid Action update.");
  }

  try {
    if (input.data.operation === "save_edit" || input.data.operation === "cancel") {
      const state = await updatePersistedAction({ ...input.data, demoSessionId, operation: input.data.operation });
      if (!state) {
        return errorResponse(409, "invalid_transition", "This Action can no longer be changed. Refresh to see its current state.");
      }
      return Response.json(ActionResponseSchema.parse(state));
    }

    const executionMode = resolveEmailExecutionMode(process.env.EMAIL_EXECUTION_MODE);
    const claimed = await claimPersistedActionExecution({
      ...input.data,
      demoSessionId,
      executionMode,
      operation: input.data.operation,
    });
    if (!claimed) {
      return errorResponse(409, "invalid_transition", "This Action can no longer be changed. Refresh to see its current state.");
    }

    // Duplicate/retried requests return the persisted result and never call Resend again.
    if (!claimed.claimed) {
      if (claimed.action.status !== "approved") {
        return errorResponse(409, "invalid_transition", "This Action cannot be executed.");
      }
      return Response.json(ActionResponseSchema.parse({ action: claimed.action, events: claimed.events }));
    }

    const result = await executeEmailByMode(executionMode, () => sendApprovedDraftToTestInbox(claimed.action));
    const completed = await finalizePersistedActionExecution(demoSessionId, claimed.action, result);
    return Response.json(ActionResponseSchema.parse(completed));
  } catch (error) {
    if (error instanceof PersistenceConfigurationError) {
      return errorResponse(503, "persistence_unavailable", "Action persistence is not configured.");
    }
    if (error instanceof PersistenceError) {
      console.error("The Action decision could not be persisted.");
      return errorResponse(503, "persistence_unavailable", "The Action could not be saved. Please try again.");
    }
    throw error;
  }
}
