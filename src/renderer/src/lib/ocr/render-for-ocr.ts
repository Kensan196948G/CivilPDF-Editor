import type { PDFPageProxy } from "pdfjs-dist";

export const OCR_SCALE = 2.0; // ~144 DPI effective (72 DPI * 2)

/**
 * Render a PDF page to an OffscreenCanvas at OCR_SCALE.
 * Returns the canvas so the caller can extract ImageData or transfer to a worker.
 */
export async function renderPageForOcr(
  page: PDFPageProxy,
  scale = OCR_SCALE,
): Promise<{ canvas: OffscreenCanvas; width: number; height: number }> {
  const viewport = page.getViewport({ scale });
  const canvas = new OffscreenCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");
  await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;
  return { canvas, width: viewport.width, height: viewport.height };
}
