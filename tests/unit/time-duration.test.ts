import { describe, expect, it } from "vitest";
import { addDays, formatMinutes, parseDuration, weekStartOf } from "@/lib/validation/time";

describe("time helpers", () => {
  it("reads the ways people type durations", () => {
    expect(parseDuration("1:30")).toBe(90);
    expect(parseDuration("1.5")).toBe(90);
    expect(parseDuration("1,5")).toBe(90);
    expect(parseDuration("2h")).toBe(120);
    expect(parseDuration("1h 15m")).toBe(75);
    expect(parseDuration("45m")).toBe(45);
    expect(parseDuration("45 min")).toBe(45);
    expect(parseDuration(0.25)).toBe(15);
    for (const bad of ["", "abc", "1:75", "-1", "1:30:00"]) expect(parseDuration(bad)).toBeNull();
  });
  it("formats minutes and finds the Monday of a week", () => {
    expect(formatMinutes(95)).toBe("1:35");
    expect(formatMinutes(5)).toBe("0:05");
    expect(weekStartOf("2026-11-10")).toBe("2026-11-09"); // Tuesday → Monday
    expect(weekStartOf("2026-11-15")).toBe("2026-11-09"); // Sunday → Monday
    expect(weekStartOf("2026-11-09")).toBe("2026-11-09");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
