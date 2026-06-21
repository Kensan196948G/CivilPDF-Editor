// LRU tile cache with pixel-count budget.
// Map iteration order == insertion order in V8 — oldest entry is map.entries().next().
const PIXEL_BUDGET = 128 * 1024 * 1024; // 128 M pixels ≈ 512 MB at 4 bytes/pixel

interface Entry {
  bitmap: ImageBitmap;
  pixels: number;
}

export class TileCache {
  private readonly map = new Map<string, Entry>();
  private pixelTotal = 0;

  get(key: string): ImageBitmap | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    // Promote to most-recently-used position.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.bitmap;
  }

  set(key: string, bitmap: ImageBitmap, w: number, h: number): void {
    if (this.map.has(key)) {
      const old = this.map.get(key)!;
      old.bitmap.close();
      this.pixelTotal -= old.pixels;
      this.map.delete(key);
    }
    const pixels = w * h;
    this.map.set(key, { bitmap, pixels });
    this.pixelTotal += pixels;
    this.evict();
  }

  delete(key: string): void {
    const entry = this.map.get(key);
    if (!entry) return;
    entry.bitmap.close();
    this.pixelTotal -= entry.pixels;
    this.map.delete(key);
  }

  clear(): void {
    for (const entry of this.map.values()) entry.bitmap.close();
    this.map.clear();
    this.pixelTotal = 0;
  }

  get size(): number {
    return this.map.size;
  }

  get pixelCount(): number {
    return this.pixelTotal;
  }

  private evict(): void {
    // Evict least-recently-used entries until under budget.
    const iter = this.map.entries();
    while (this.pixelTotal > PIXEL_BUDGET) {
      const next = iter.next();
      if (next.done) break;
      const [k, entry] = next.value;
      entry.bitmap.close();
      this.pixelTotal -= entry.pixels;
      this.map.delete(k);
    }
  }
}

export const globalTileCache = new TileCache();
