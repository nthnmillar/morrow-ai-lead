import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EnquiryDetail } from "@/components/enquiry-detail";
import { WorkspaceShell } from "@/components/workspace-shell";
import { mockEnquiries } from "@/lib/mock-workspace";
import type { LeadAnalysis } from "@/lib/lead-analysis-schema";
import {
  getLatestAnalysis,
  PersistenceConfigurationError,
  PersistenceError,
} from "@/lib/persistence/supabase";

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

  let initialAnalysis: LeadAnalysis | null = null;
  let persistenceError: string | null = null;
  try {
    initialAnalysis = await getLatestAnalysis(enquiry.id);
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
        persistenceError={persistenceError}
      />
    </WorkspaceShell>
  );
}