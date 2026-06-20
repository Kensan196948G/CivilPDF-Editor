import type { Stamp } from "./types";

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Convert a stamp's top-left fractional rect into pdf-lib coordinates
 * (origin bottom-left). Height is derived from the image aspect ratio so it
 * matches the `height:auto` rendering in the editor overlay.
 */
export function toPdfRect(
  stamp: Pick<Stamp, "x" | "y" | "w" | "ratio">,
  pageW: number,
  pageH: number,
): PdfRect {
  const width = stamp.w * pageW;
  const height = stamp.ratio > 0 ? width / stamp.ratio : width;
  const x = stamp.x * pageW;
  const y = pageH - stamp.y * pageH - height;
  return { x, y, width, height };
}
