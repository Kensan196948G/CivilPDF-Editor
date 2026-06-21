import { describe, it, expect } from "vitest";
import { snapToLOD, lodCacheKey } from "./lod";

describe("snapToLOD", () => {
  it("snaps 0.3 up to 0.5", () => {
    expect(snapToLOD(0.3)).toBe(0.5);
  });

  it("snaps 0.5 exactly to 0.5", () => {
    expect(snapToLOD(0.5)).toBe(0.5);
  });

  it("snaps 0.8 up to 1.0", () => {
    expect(snapToLOD(0.8)).toBe(1.0);
  });

  it("snaps 1.2 up to 1.5", () => {
    expect(snapToLOD(1.2)).toBe(1.5);
  });

  it("snaps 2.0 exactly to 2.0", () => {
    expect(snapToLOD(2.0)).toBe(2.0);
  });

  it("snaps 3.5 up to max anchor 3.0", () => {
    expect(snapToLOD(3.5)).toBe(3.0);
  });
});

describe("lodCacheKey", () => {
  it("produces consistent string for same LOD bucket", () => {
    expect(lodCacheKey(0.8)).toBe(lodCacheKey(0.9));
  });

  it("produces different strings for different LOD buckets", () => {
    expect(lodCacheKey(0.8)).not.toBe(lodCacheKey(1.2));
  });
});
