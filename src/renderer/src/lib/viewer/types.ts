/** Pixel size of each tile. Must be power-of-2 for future GPU atlas compatibility. */
export const TILE_SIZE = 1024;

/**
 * Pages whose viewport dimension (width or height) exceeds this value at the
 * current scale are rendered with TiledStrategy instead of SingleCanvasStrategy.
 * A4 at scale 1.2 ≈ 713×1009 px — well below. A1 ≈ 2018×2861 px — above.
 */
export const LARGE_PAGE_THRESHOLD = 3000;

/** One cell of the tile grid. All pixel coordinates are in viewport space. */
export interface TileRect {
  col: number;
  row: number;
  x: number; // left offset in viewport pixels
  y: number; // top offset in viewport pixels
  w: number; // pixel width  (may be < TILE_SIZE for edge tiles)
  h: number; // pixel height (may be < TILE_SIZE for edge tiles)
}

/** Pre-computed grid of tiles covering a full page viewport. */
export interface TileGrid {
  tiles: TileRect[];
  cols: number;
  rows: number;
  totalW: number;
  totalH: number;
}
