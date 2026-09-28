import { canTransition, formatDuration, isOverdue, slaIntervalSql } from "@/lib/sla";

const NOW = new Date("2026-01-10T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe("isOverdue", () => {
  it("is not overdue exactly at the SLA limit", () => {
    expect(isOverdue({ status: "open", priority: "urgent", createdAt: hoursAgo(4) }, NOW)).toBe(false);
  });

  it("is overdue one minute past the SLA limit", () => {
    const createdAt = new Date(NOW.getTime() - (4 * 60 + 1) * 60_000).toISOString();
    expect(isOverdue({ status: "in_progress", priority: "urgent", createdAt }, NOW)).toBe(true);
  });

  it("uses a longer limit for lower priorities", () => {
    expect(isOverdue({ status: "open", priority: "low", createdAt: hoursAgo(100) }, NOW)).toBe(false);
    expect(isOverdue({ status: "open", priority: "medium", createdAt: hoursAgo(100) }, NOW)).toBe(true);
  });

  it("never marks resolved or closed tickets overdue", () => {
    expect(isOverdue({ status: "resolved", priority: "urgent", createdAt: hoursAgo(500) }, NOW)).toBe(false);
    expect(isOverdue({ status: "closed", priority: "urgent", createdAt: hoursAgo(500) }, NOW)).toBe(false);
  });
});

describe("canTransition", () => {
  it.each([
    ["open", "in_progress", true],
    ["open", "resolved", true],
    ["resolved", "in_progress", true],
    ["closed", "open", true],
    ["closed", "resolved", false],
    ["resolved", "open", false],
    ["open", "open", true],
  ] as const)("%s -> %s is %s", (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "1m"],
    [45 * 60_000, "45m"],
    [3 * 3_600_000, "3h"],
    [3 * 3_600_000 + 20 * 60_000, "3h 20m"],
    [2 * 86_400_000, "2d"],
    [2 * 86_400_000 + 4 * 3_600_000 + 59 * 60_000, "2d 4h"],
  ])("%i ms -> %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe("slaIntervalSql", () => {
  it("builds one CASE branch per priority", () => {
    expect(slaIntervalSql("t.priority")).toBe(
      "(CASE t.priority WHEN 'urgent' THEN interval '4 hours' WHEN 'high' THEN interval '24 hours' " +
        "WHEN 'medium' THEN interval '72 hours' WHEN 'low' THEN interval '168 hours' END)",
    );
  });
});
