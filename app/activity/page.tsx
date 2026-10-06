import { ActivityHistory } from "@/components/activity-history";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function ActivityPage() {
  // The shared shell handles navigation; the client feed owns local activity filtering.
  return <WorkspaceShell><ActivityHistory /></WorkspaceShell>;
}