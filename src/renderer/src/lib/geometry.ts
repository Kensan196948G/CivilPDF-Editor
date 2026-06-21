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

/**
 * Convert a fractional point (0..1, top-left origin) into pdf-lib coordinates
 * (origin bottom-left). Used by annotation embedding (lines, ink strokes).
 */
export function fracPointToPdf(
  x: number,
  y: number,
  pageW: number,
  pageH: number,
): { x: number; y: number } {
  return { x: x * pageW, y: pageH - y * pageH };
}

/**
 * Convert a fractional rect (0..1, top-left origin) into a pdf-lib rect
 * (origin bottom-left). Unlike {@link toPdfRect}, height is explicit rather
 * than derived from an aspect ratio.
 */
export function fracRectToPdf(
  rect: { x: number; y: number; w: number; h: number },
  pageW: number,
  pageH: number,
): PdfRect {
  const width = rect.w * pageW;
  const height = rect.h * pageH;
  const x = rect.x * pageW;
  const y = pageH - rect.y * pageH - height;
  return { x, y, width, height };
}
