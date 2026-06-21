import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { OcrDocumentResult, OcrWord } from "./types";

/** Convert OcrWord (fraction, top-left origin) to pdf-lib coordinates (bottom-left origin). */
function ocrWordToPdfRect(
  word: OcrWord,
  pageW: number,
  pageH: number,
): { x: number; y: number; width: number; height: number } {
  const width = word.w * pageW;
  const height = word.h * pageH;
  const x = word.x * pageW;
  // pdf-lib: y is distance from bottom. top-left origin → bottom-left: y = pageH - top - height
  const y = pageH - word.y * pageH - height;
  return { x, y, width, height };
}

/**
 * Embed invisible text layer from OCR results into a PDF.
 * Uses Helvetica (Latin) for now. Japanese requires @pdf-lib/fontkit + TTF subset.
 * Existing page content and stamps remain unchanged.
 */
export async function embedTextLayer(
  originalBytes: Uint8Array,
  ocrResult: OcrDocumentResult,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(originalBytes);
  const pages = doc.getPages();
  // Helvetica covers ASCII. Japanese characters are skipped until TTF support is added.
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const pageResult of ocrResult.pages) {
    const page = pages[pageResult.page];
    if (!page) continue;
    const { width: pw, height: ph } = page.getSize();

    for (const word of pageResult.words) {
      if (!word.text.trim()) continue;
      const rect = ocrWordToPdfRect(word, pw, ph);
      const fontSize = Math.max(4, rect.height * 0.9);

      // Extract only ASCII-printable characters for Helvetica compatibility
      const asciiText = word.text.replace(/[^\x20-\x7E]/g, "");
      if (!asciiText) continue;

      page.drawText(asciiText, {
        x: rect.x,
        y: rect.y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
        opacity: 0,  // invisible — searchable only
      });
    }
  }

  return doc.save();
}
