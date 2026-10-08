import { ActivityHistory } from "@/components/activity-history";
import { WorkspaceShell } from "@/components/workspace-shell";
import { connection } from "next/server";
import type { PersistedActivityEvent } from "@/lib/activity-event-schema";
import {
  getPersistedActivityEvents,
  PersistenceConfigurationError,
  PersistenceError,
} from "@/lib/persistence/supabase";
import { getDemoSessionId } from "@/lib/demo-session-server";

export default async function ActivityPage() {
  await connection();
  const demoSessionId = await getDemoSessionId();
  let events: PersistedActivityEvent[] = [];
  let persistenceError: string | null = null;
  try {
    events = await getPersistedActivityEvents(demoSessionId);
  } catch (error) {
    if (error instanceof PersistenceConfigurationError) {
      persistenceError = "Saved activity is unavailable until Supabase is configured.";
    } else if (error instanceof PersistenceError) {
      console.error("Could not load saved workspace activity.");
      persistenceError = "Saved activity could not be loaded. Fixture history is shown instead.";
    } else {
      throw error;
    }
  }
  return <WorkspaceShell><ActivityHistory persistedEvents={events} persistenceError={persistenceError} /></WorkspaceShell>;
}
