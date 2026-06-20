import { describe, it, expect } from "vitest";
import { formatStampDate } from "./stamp";

describe("formatStampDate", () => {
  it("formats as YYYY.MM.DD with zero padding", () => {
    expect(formatStampDate(new Date(2026, 0, 5))).toBe("2026.01.05");
    expect(formatStampDate(new Date(2026, 11, 31))).toBe("2026.12.31");
  });
});
