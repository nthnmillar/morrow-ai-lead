import { ActivityHistory } from "@/components/activity-history";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function ActivityPage() {
  return <WorkspaceShell><ActivityHistory /></WorkspaceShell>;
}