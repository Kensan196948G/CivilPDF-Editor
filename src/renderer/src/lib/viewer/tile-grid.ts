import type { TileGrid, TileRect } from "./types";
import { TILE_SIZE } from "./types";

/**
 * Partition (totalW × totalH) into a regular grid of tiles.
 * Edge tiles are smaller when dimensions are not multiples of tileSize.
 */
export function buildTileGrid(
  totalW: number,
  totalH: number,
  tileSize = TILE_SIZE,
): TileGrid {
  const cols = Math.ceil(totalW / tileSize);
  const rows = Math.ceil(totalH / tileSize);
  const tiles: TileRect[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * tileSize;
      const y = row * tileSize;
      tiles.push({
        col,
        row,
        x,
        y,
        w: Math.min(tileSize, totalW - x),
        h: Math.min(tileSize, totalH - y),
      });
    }
  }

  return { tiles, cols, rows, totalW, totalH };
}
