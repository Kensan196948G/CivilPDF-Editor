/**
 * Markup annotation models. All coordinates follow the same convention as
 * {@link Stamp}: page-relative fractions (0..1) with a top-left origin, so they
 * survive zoom and page-size changes and reuse the existing `toPdfRect` /
 * `fracPointToPdf` converters.
 */

export type AnnotKind = "highlight" | "underline" | "strikeout" | "note" | "ink";

interface AnnotBase {
  id: string;
  page: number; // 0-based page index
  color: string; // CSS color, e.g. "#ffeb3b"
}

/** A point in page-relative fractions (0..1), top-left origin. */
export interface FracPoint {
  x: number;
  y: number;
}

/** A rectangle in page-relative fractions (0..1), top-left origin. */
export interface FracRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Highlight / underline / strikeout over one or more text rectangles. */
export interface RectAnnot extends AnnotBase {
  kind: "highlight" | "underline" | "strikeout";
  rects: FracRect[];
}

/** A sticky note anchored at a point. */
export interface NoteAnnot extends AnnotBase {
  kind: "note";
  x: number;
  y: number;
  text: string;
}

/** Freehand ink: a set of strokes, each a polyline of fractional points. */
export interface InkAnnot extends AnnotBase {
  kind: "ink";
  strokes: FracPoint[][];
  width: number; // stroke width as fraction of page width (0..1)
}

export type Annotation = RectAnnot | NoteAnnot | InkAnnot;
