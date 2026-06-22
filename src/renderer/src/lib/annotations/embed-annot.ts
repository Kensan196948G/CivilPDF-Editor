import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { RGB, PDFFont, PDFPage } from "pdf-lib";
import type { Annotation, FracRect, TextEditAnnot } from "./types";
import { fracPointToPdf, fracRectToPdf } from "../geometry";
import { loadCjkFontBytes } from "./cjk-font";

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
 * Draw a sticky-note marker: a small square icon plus a "!" badge.
 * The note body text is intentionally not rendered into the flattened PDF — the
 * marker stays icon-only and the text lives in the editable annotation layer
 * (rendering arbitrary-length note bodies in a fixed marker is a separate UX
 * concern). The badge uses the bundled CJK font, so ASCII renders fine.
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
 * Draw a text-edit annotation: first burn a white rectangle (whiteout) over the
 * original text, then draw the replacement text on the SAME baseline at the
 * SAME size as the original.
 *
 * Position/size come from page-height fractions (baselineFrac / fontHeightFrac),
 * so the PDF baseline lands exactly on the original text's baseline. Uses the
 * bundled NotoSansJP font so Japanese renders. The size is shrunk only if the
 * replacement would overflow the whiteout width (CJK has no spaces, so pdf-lib's
 * word-wrap would not help).
 */
async function drawTextEdit(
  page: PDFPage,
  annot: TextEditAnnot,
  getFont: () => Promise<PDFFont>,
  pw: number,
  ph: number,
): Promise<void> {
  const r = fracRectToPdf(annot.rect, pw, ph);

  // 1. Whiteout: paint white rectangle over the original text area.
  page.drawRectangle({
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    color: rgb(1, 1, 1),
    opacity: 1,
  });

  // Nothing to draw (e.g. text deletion): skip font embedding entirely so an
  // unused subset (zero glyphs) never reaches fontkit, which would throw.
  if (!annot.newText) return;
  const font = await getFont();

  // 2. Size = original font height (points); baseline = original baseline (pt,
  //    bottom-origin). pdf-lib's drawText y IS the baseline.
  let size = Math.max(4, annot.fontHeightFrac * ph);
  const baselineY = ph - annot.baselineFrac * ph;

  // 3. Shrink to fit the whiteout width on a single line (min 4pt).
  const maxWidth = Math.max(1, r.width - 2);
  const textWidth = font.widthOfTextAtSize(annot.newText, size);
  if (textWidth > maxWidth) {
    size = Math.max(4, (size * maxWidth) / textWidth);
  }

  // 4. Draw the replacement text on the original baseline.
  page.drawText(annot.newText, {
    x: r.x + 1,
    y: baselineY,
    size,
    font,
    color: rgb(0, 0, 0),
  });
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
  doc.registerFontkit(fontkit);
  const pages = doc.getPages();

  // Lazily embed the bundled CJK font as a subset (only used glyphs are written
  // to the output). Needed for text edits and note markers; supports Japanese.
  let cjkFont: PDFFont | null = null;
  const getFont = async (): Promise<PDFFont> => {
    if (!cjkFont) {
      const fontBytes = await loadCjkFontBytes();
      cjkFont = await doc.embedFont(fontBytes, { subset: true });
    }
    return cjkFont;
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
      case "textedit":
        await drawTextEdit(page, annot, getFont, pw, ph);
        break;
    }
  }

  return doc.save();
}
