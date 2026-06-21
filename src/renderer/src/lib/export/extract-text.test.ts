import { describe, it, expect } from "vitest";
import { clusterLines } from "./extract-text";

describe("clusterLines", () => {
  it("joins same-y words in ascending x order into one line", () => {
    const lines = clusterLines([
      { str: "world", x: 50, y: 100 },
      { str: "hello", x: 10, y: 100 },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("helloworld");
    expect(lines[0].x).toBe(10);
    expect(lines[0].y).toBe(100);
  });

  it("separates items into different lines when y differs beyond tolerance", () => {
    const lines = clusterLines([
      { str: "top", x: 0, y: 200 },
      { str: "bottom", x: 0, y: 100 },
    ]);
    expect(lines).toHaveLength(2);
  });

  it("orders lines top→bottom (y descending)", () => {
    const lines = clusterLines([
      { str: "lower", x: 0, y: 50 },
      { str: "upper", x: 0, y: 150 },
      { str: "middle", x: 0, y: 100 },
    ]);
    expect(lines.map((l) => l.text)).toEqual(["upper", "middle", "lower"]);
  });

  it("groups items within the y tolerance into the same line", () => {
    const lines = clusterLines(
      [
        { str: "a", x: 0, y: 100 },
        { str: "b", x: 10, y: 101 },
      ],
      2,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("ab");
  });

  it("preserves Japanese strings", () => {
    const lines = clusterLines([
      { str: "図面", x: 0, y: 100 },
      { str: "番号", x: 30, y: 100 },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("図面番号");
  });

  it("returns an empty array for empty input", () => {
    expect(clusterLines([])).toEqual([]);
  });
});
