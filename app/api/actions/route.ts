import { mockEnquiries } from "@/lib/mock-workspace";
import {
  ActionErrorSchema,
  ActionResponseSchema,
  UpdateActionRequestSchema,
} from "@/lib/action-schema";
import {
  PersistenceConfigurationError,
  PersistenceError,
  updatePersistedAction,
} from "@/lib/persistence/supabase";

function errorResponse(
  status: number,
  code: "invalid_request" | "invalid_transition" | "persistence_unavailable",
  message: string,
) {
  return Response.json(ActionErrorSchema.parse({ error: { code, message } }), { status });
}

export async function PATCH(request: Request) {
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
    const action = await updatePersistedAction(input.data);
    if (!action) {
      return errorResponse(409, "invalid_transition", "This Action can no longer be changed. Refresh to see its current state.");
    }
    return Response.json(ActionResponseSchema.parse({ action }));
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
