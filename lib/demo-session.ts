import { z } from "zod";

export const DEMO_SESSION_COOKIE = "morrow_demo_session";
export const DemoSessionIdSchema = z.uuid();

export type DemoSessionId = z.infer<typeof DemoSessionIdSchema>;

export function parseDemoSessionId(value: unknown): DemoSessionId | null {
  const parsed = DemoSessionIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function belongsToDemoSession(record: { demoSessionId: string }, demoSessionId: DemoSessionId) {
  return record.demoSessionId === demoSessionId;
}

export function filterForDemoSession<T extends { demoSessionId: string }>(records: T[], demoSessionId: DemoSessionId): T[] {
  return records.filter((record) => belongsToDemoSession(record, demoSessionId));
}
