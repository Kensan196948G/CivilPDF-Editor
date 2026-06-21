// Discrete LOD anchors — tiles are always rendered at the next anchor ≥ display scale.
// Drawing the bitmap scaled to display size amortizes quality vs. memory.
const LOD_ANCHORS = [0.5, 1.0, 1.5, 2.0, 3.0];

/** Returns the render scale snapped up to the nearest LOD anchor. */
export function snapToLOD(displayScale: number): number {
  return LOD_ANCHORS.find((a) => a >= displayScale) ?? LOD_ANCHORS[LOD_ANCHORS.length - 1];
}

/** Cache key component that groups similar display scales to the same render. */
export function lodCacheKey(displayScale: number): string {
  return snapToLOD(displayScale).toFixed(1);
}
