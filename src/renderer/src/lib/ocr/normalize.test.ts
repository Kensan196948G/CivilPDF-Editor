import { describe, it, expect } from "vitest";
import { normalizeWord, buildLine } from "./normalize";

describe("normalizeWord", () => {
  it("center bbox maps to 0.5, 0.5", () => {
    const w = normalizeWord("text", { x0: 250, y0: 250, x1: 500, y1: 500 }, 90, 1000, 1000);
    expect(w.x).toBeCloseTo(0.25);
    expect(w.y).toBeCloseTo(0.25);
    expect(w.w).toBeCloseTo(0.25);
    expect(w.h).toBeCloseTo(0.25);
    expect(w.confidence).toBe(90);
    expect(w.text).toBe("text");
  });

  it("full-page bbox is (0, 0, 1, 1)", () => {
    const w = normalizeWord("A", { x0: 0, y0: 0, x1: 800, y1: 600 }, 100, 800, 600);
    expect(w.x).toBe(0);
    expect(w.y).toBe(0);
    expect(w.w).toBe(1);
    expect(w.h).toBe(1);
  });

  it("non-square canvas normalizes independently per axis", () => {
    const w = normalizeWord("B", { x0: 0, y0: 0, x1: 200, y1: 100 }, 80, 400, 200);
    expect(w.w).toBeCloseTo(0.5);
    expect(w.h).toBeCloseTo(0.5);
  });
});

describe("buildLine", () => {
  it("joins word texts with space", () => {
    const words = [
      { text: "hello", x: 0, y: 0, w: 0.1, h: 0.05, confidence: 90 },
      { text: "world", x: 0.15, y: 0, w: 0.1, h: 0.05, confidence: 85 },
    ];
    const line = buildLine(words);
    expect(line.text).toBe("hello world");
    expect(line.words).toHaveLength(2);
  });
});
