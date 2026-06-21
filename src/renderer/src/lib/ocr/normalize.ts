import type { OcrWord, OcrLine } from "./types";

interface PixelBbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Convert a px bbox from Tesseract into page-relative fractions. */
export function normalizeWord(
  text: string,
  bbox: PixelBbox,
  confidence: number,
  canvasW: number,
  canvasH: number,
): OcrWord {
  const x = bbox.x0 / canvasW;
  const y = bbox.y0 / canvasH;
  const w = (bbox.x1 - bbox.x0) / canvasW;
  const h = (bbox.y1 - bbox.y0) / canvasH;
  return { text, x, y, w, h, confidence };
}

/** Group words into a line using their normalized coordinates. */
export function buildLine(words: OcrWord[]): OcrLine {
  return {
    words,
    text: words.map((w) => w.text).join(" "),
  };
}
