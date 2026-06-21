import { describe, it, expect } from "vitest";
import { buildTileGrid } from "./tile-grid";

describe("buildTileGrid", () => {
  it("single tile when page fits within one tile", () => {
    const grid = buildTileGrid(800, 1000, 1024);
    expect(grid.cols).toBe(1);
    expect(grid.rows).toBe(1);
    expect(grid.tiles).toHaveLength(1);
    expect(grid.tiles[0]).toMatchObject({
      col: 0,
      row: 0,
      x: 0,
      y: 0,
      w: 800,
      h: 1000,
    });
  });

  it("2×2 grid when both dimensions exceed tile size", () => {
    const grid = buildTileGrid(2000, 2000, 1024);
    expect(grid.cols).toBe(2);
    expect(grid.rows).toBe(2);
    expect(grid.tiles).toHaveLength(4);
  });

  it("2×3 grid for tall page", () => {
    const grid = buildTileGrid(2000, 3000, 1024);
    expect(grid.cols).toBe(2);
    expect(grid.rows).toBe(3);
    expect(grid.tiles).toHaveLength(6);
  });

  it("edge tiles have trimmed dimensions", () => {
    // 1500 = 1024 + 476
    const grid = buildTileGrid(1500, 1500, 1024);
    const rightEdge = grid.tiles.find((t) => t.col === 1 && t.row === 0);
    expect(rightEdge?.x).toBe(1024);
    expect(rightEdge?.w).toBe(476);
    const bottomEdge = grid.tiles.find((t) => t.col === 0 && t.row === 1);
    expect(bottomEdge?.y).toBe(1024);
    expect(bottomEdge?.h).toBe(476);
  });

  it("full tile in 2×2 grid has correct coordinates", () => {
    const grid = buildTileGrid(2048, 2048, 1024);
    expect(grid.tiles).toHaveLength(4);
    expect(grid.tiles[0]).toMatchObject({ col: 0, row: 0, x: 0, y: 0, w: 1024, h: 1024 });
    expect(grid.tiles[1]).toMatchObject({ col: 1, row: 0, x: 1024, y: 0, w: 1024, h: 1024 });
    expect(grid.tiles[2]).toMatchObject({ col: 0, row: 1, x: 0, y: 1024, w: 1024, h: 1024 });
    expect(grid.tiles[3]).toMatchObject({ col: 1, row: 1, x: 1024, y: 1024, w: 1024, h: 1024 });
  });

  it("no tile exceeds the page boundary", () => {
    const W = 3456;
    const H = 2880;
    const grid = buildTileGrid(W, H, 1024);
    for (const t of grid.tiles) {
      expect(t.x + t.w).toBeLessThanOrEqual(W);
      expect(t.y + t.h).toBeLessThanOrEqual(H);
    }
  });

  it("tiles cover the entire page area without gap", () => {
    const W = 2048;
    const H = 3072;
    const grid = buildTileGrid(W, H, 1024);
    // Accumulate covered area
    let area = 0;
    for (const t of grid.tiles) area += t.w * t.h;
    expect(area).toBe(W * H);
  });
});
