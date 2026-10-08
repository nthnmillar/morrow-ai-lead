import "server-only";
import { cookies } from "next/headers";
import { DEMO_SESSION_COOKIE, parseDemoSessionId, type DemoSessionId } from "@/lib/demo-session";

export class DemoSessionError extends Error {
  constructor() {
    super("A valid demo session is required.");
    this.name = "DemoSessionError";
  }
}

export async function getDemoSessionId(): Promise<DemoSessionId> {
  const demoSessionId = parseDemoSessionId((await cookies()).get(DEMO_SESSION_COOKIE)?.value);
  if (!demoSessionId) throw new DemoSessionError();
  return demoSessionId;
}
