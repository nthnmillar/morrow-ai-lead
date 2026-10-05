import { EnquiryDashboard } from "@/components/enquiry-dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function EnquiriesPage() {
  return <WorkspaceShell><EnquiryDashboard key="enquiries" view="enquiries" /></WorkspaceShell>;
}