import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { RGB, PDFFont, PDFPage } from "pdf-lib";
import type { Annotation, FracRect } from "./types";
import { fracPointToPdf, fracRectToPdf } from "../geometry";

/** Opacity used when painting highlight rectangles. */
const HIGHLIGHT_OPACITY = 0.35;
/** Side length (pt) of the square icon drawn for note annotations. */
const NOTE_ICON_SIZE = 12;

/**
 * Convert a CSS hex colour (`#rgb` or `#rrggbb`) into a pdf-lib {@link RGB}.
 * Falls back to black for malformed input so embedding never throws.
 */
export function hexToRgb(hex: string): RGB {
  let value = hex.trim().replace(/^#/, "");
  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (value.length !== 6 || /[^0-9a-fA-F]/.test(value)) {
    return rgb(0, 0, 0);
  }
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/** Draw a highlight as a translucent filled rectangle per text rect. */
function drawHighlight(
  page: PDFPage,
  rects: FracRect[],
  color: RGB,
  pw: number,
  ph: number,
): void {
  for (const rect of rects) {
    const r = fracRectToPdf(rect, pw, ph);
    page.drawRectangle({
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      color,
      opacity: HIGHLIGHT_OPACITY,
    });
  }
}

/**
 * Draw a horizontal line along each rect. `atTop` selects the y position:
 * the rect's bottom edge for underline, its vertical centre for strikeout.
 */
function drawRuleLines(
  page: PDFPage,
  rects: FracRect[],
  color: RGB,
  thickness: number,
  mode: "underline" | "strikeout",
  pw: number,
  ph: number,
): void {
  for (const rect of rects) {
    const r = fracRectToPdf(rect, pw, ph);
    const y = mode === "underline" ? r.y : r.y + r.height / 2;
    page.drawLine({
      start: { x: r.x, y },
      end: { x: r.x + r.width, y },
      thickness,
      color,
    });
  }
}

/**
 * Draw a sticky-note marker: a small square icon plus an ASCII "!" badge.
 * The note body text is intentionally not rendered — the standard Helvetica
 * font cannot encode non-ASCII (e.g. Japanese) glyphs, so we keep the burned
 * marker icon-only and leave the text in the editable annotation layer.
 */
function drawNoteMarker(
  page: PDFPage,
  x: number,
  y: number,
  color: RGB,
  font: PDFFont,
  pw: number,
  ph: number,
): void {
  const p = fracPointToPdf(x, y, pw, ph);
  // Anchor the icon so the point sits at its top-left corner.
  const iconY = p.y - NOTE_ICON_SIZE;
  page.drawRectangle({
    x: p.x,
    y: iconY,
    width: NOTE_ICON_SIZE,
    height: NOTE_ICON_SIZE,
    color,
    opacity: 0.85,
  });
  page.drawText("!", {
    x: p.x + NOTE_ICON_SIZE / 2 - 2,
    y: iconY + 2,
    size: NOTE_ICON_SIZE - 4,
    font,
    color: rgb(1, 1, 1),
  });
}

/** Draw each ink stroke as connected line segments between fractional points. */
function drawInk(
  page: PDFPage,
  strokes: { x: number; y: number }[][],
  color: RGB,
  widthFrac: number,
  pw: number,
  ph: number,
): void {
  const thickness = Math.max(0.5, widthFrac * pw);
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i += 1) {
      const a = fracPointToPdf(stroke[i - 1].x, stroke[i - 1].y, pw, ph);
      const b = fracPointToPdf(stroke[i].x, stroke[i].y, pw, ph);
      page.drawLine({ start: a, end: b, thickness, color });
    }
  }
}

/**
 * Burn the given annotations into the PDF using vector drawing and return the
 * new bytes. Annotations referencing a non-existent page are skipped.
 */
export async function embedAnnotationsIntoPdf(
  bytes: Uint8Array,
  annotations: Annotation[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages();

  // Lazily embed the standard font; only needed for note markers.
  let helvetica: PDFFont | null = null;
  const getFont = async (): Promise<PDFFont> => {
    if (!helvetica) helvetica = await doc.embedFont(StandardFonts.Helvetica);
    return helvetica;
  };

  for (const annot of annotations) {
    const page = pages[annot.page];
    if (!page) continue; // out-of-range page: ignore

    const { width: pw, height: ph } = page.getSize();
    const color = hexToRgb(annot.color);

    switch (annot.kind) {
      case "highlight":
        drawHighlight(page, annot.rects, color, pw, ph);
        break;
      case "underline":
        drawRuleLines(page, annot.rects, color, 1.5, "underline", pw, ph);
        break;
      case "strikeout":
        drawRuleLines(page, annot.rects, color, 1.5, "strikeout", pw, ph);
        break;
      case "note":
        drawNoteMarker(page, annot.x, annot.y, color, await getFont(), pw, ph);
        break;
      case "ink":
        drawInk(page, annot.strokes, color, annot.width, pw, ph);
        break;
    }
  }

  return doc.save();
}
