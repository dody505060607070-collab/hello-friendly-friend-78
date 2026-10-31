import { describe, expect, it } from "vitest";
import { isMeetingReminderDue } from "../meeting-reminders.server";

const base = { status: "new", due_date: "2099-01-01", due_time: "10:00", meeting_interval_hours: 12 };
const now = new Date("2026-11-01T00:00:00Z");

describe("meeting reminders", () => {
  it("sends first reminder right away", () => expect(isMeetingReminderDue({ ...base, meeting_last_sent_at: null }, now)).toBe(true));
  it("waits 12 hours between reminders", () => {
    expect(isMeetingReminderDue({ ...base, meeting_last_sent_at: "2026-10-31T18:00:00Z" }, now)).toBe(false);
    expect(isMeetingReminderDue({ ...base, meeting_last_sent_at: "2026-10-31T12:00:00Z" }, now)).toBe(true);
  });
  it("stops after the meeting time", () => expect(isMeetingReminderDue({ ...base, due_date: "2026-10-30", meeting_last_sent_at: null }, now)).toBe(false));
  it("stops when task is done", () => expect(isMeetingReminderDue({ ...base, status: "done", meeting_last_sent_at: null }, now)).toBe(false));
});
