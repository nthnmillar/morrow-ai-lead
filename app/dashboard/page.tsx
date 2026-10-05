import { EnquiryDashboard } from "@/components/enquiry-dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function DashboardPage() {
  return <WorkspaceShell><EnquiryDashboard key="overview" view="overview" /></WorkspaceShell>;
}