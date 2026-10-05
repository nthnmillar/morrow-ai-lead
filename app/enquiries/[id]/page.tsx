import { notFound } from "next/navigation";
import { EnquiryDetail } from "@/components/enquiry-detail";
import { WorkspaceShell } from "@/components/workspace-shell";
import { mockEnquiries } from "@/lib/mock-workspace";

export function generateStaticParams() {
  return mockEnquiries.map((enquiry) => ({ id: enquiry.id }));
}

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const enquiry = mockEnquiries.find((item) => item.id === id);

  if (!enquiry) notFound();

  return <WorkspaceShell><EnquiryDetail key={enquiry.id} enquiry={enquiry} /></WorkspaceShell>;
}