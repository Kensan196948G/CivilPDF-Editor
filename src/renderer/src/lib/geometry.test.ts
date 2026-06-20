import { describe, it, expect } from "vitest";
import { clamp01, toPdfRect } from "./geometry";

describe("clamp01", () => {
  it("clamps to [0,1]", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.3)).toBe(0.3);
  });
});

describe("toPdfRect", () => {
  it("maps top-left fractions to bottom-left pdf coords", () => {
    // square stamp (ratio 1), 10% width, at 20% from left, 30% from top
    const r = toPdfRect({ x: 0.2, y: 0.3, w: 0.1, ratio: 1 }, 1000, 800);
    expect(r.width).toBe(100);
    expect(r.height).toBe(100);
    expect(r.x).toBe(200);
    // y = pageH - y*pageH - height = 800 - 240 - 100 = 460
    expect(r.y).toBe(460);
  });

  it("derives height from aspect ratio (wide stamp)", () => {
    const r = toPdfRect({ x: 0, y: 0, w: 0.5, ratio: 2 }, 1000, 1000);
    expect(r.width).toBe(500);
    expect(r.height).toBe(250); // width / ratio
    expect(r.y).toBe(750); // top edge: 1000 - 0 - 250
  });

  it("falls back to square when ratio is non-positive", () => {
    const r = toPdfRect({ x: 0, y: 0, w: 0.2, ratio: 0 }, 500, 500);
    expect(r.width).toBe(100);
    expect(r.height).toBe(100);
  });
});
