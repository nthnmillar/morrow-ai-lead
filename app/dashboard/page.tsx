import { EnquiryDashboard } from "@/components/enquiry-dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function DashboardPage() {
  // The overview starts the shared queue component in its attention-focused view.
  return <WorkspaceShell><EnquiryDashboard key="overview" view="overview" /></WorkspaceShell>;
}