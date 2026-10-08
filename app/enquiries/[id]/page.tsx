import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EnquiryDetail } from "@/components/enquiry-detail";
import { WorkspaceShell } from "@/components/workspace-shell";
import { mockEnquiries } from "@/lib/mock-workspace";
import type { LeadAnalysis } from "@/lib/lead-analysis-schema";
import type { PersistedAction } from "@/lib/action-schema";
import type { PersistedActivityEvent } from "@/lib/activity-event-schema";
import {
  getLatestAnalysisState,
  PersistenceConfigurationError,
  PersistenceError,
} from "@/lib/persistence/supabase";
import { getDemoSessionId } from "@/lib/demo-session-server";
import { resolveEmailExecutionMode } from "@/lib/execution-schema";

export function generateStaticParams() {
  // Pre-render only the detail routes represented by the current fixture set.
  return mockEnquiries.map((enquiry) => ({ id: enquiry.id }));
}

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  // Next.js exposes dynamic route params asynchronously.
  const { id } = await params;
  const enquiry = mockEnquiries.find((item) => item.id === id);

  if (!enquiry) notFound();

  // Persisted state must be read for each visit, not frozen into the static fixture page at build time.
  await connection();
  const demoSessionId = await getDemoSessionId();
  const executionMode = resolveEmailExecutionMode(process.env.EMAIL_EXECUTION_MODE);

  let initialAnalysis: LeadAnalysis | null = null;
  let initialAction: PersistedAction | null = null;
  let initialEvents: PersistedActivityEvent[] = [];
  let persistenceError: string | null = null;
  try {
    const state = await getLatestAnalysisState(demoSessionId, enquiry.id);
    initialAnalysis = state?.analysis ?? null;
    initialAction = state?.action ?? null;
    initialEvents = state?.events ?? [];
  } catch (error) {
    if (error instanceof PersistenceConfigurationError) {
      persistenceError = "Saved analysis is unavailable until Supabase is configured.";
    } else if (error instanceof PersistenceError) {
      console.error("Could not load the saved enquiry analysis.");
      persistenceError = "The saved analysis could not be loaded. Please try again later.";
    } else {
      throw error;
    }
  }

  return (
    <WorkspaceShell>
      <EnquiryDetail
        key={enquiry.id}
        enquiry={enquiry}
        initialAnalysis={initialAnalysis}
        initialAction={initialAction}
        initialEvents={initialEvents}
        executionMode={executionMode}
        persistenceError={persistenceError}
      />
    </WorkspaceShell>
  );
}
