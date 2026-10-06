import { EnquiryDashboard } from "@/components/enquiry-dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function EnquiriesPage() {
  // The full queue reuses the overview component but starts with no status filter.
  return <WorkspaceShell><EnquiryDashboard key="enquiries" view="enquiries" /></WorkspaceShell>;
}