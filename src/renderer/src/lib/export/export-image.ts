import type { PDFPageProxy } from "pdfjs-dist";

export interface ExportImageOptions {
  type?: "image/png" | "image/jpeg";
  quality?: number;
  scale?: number;
}

/**
 * Render a PDF page to a raster image and return the encoded bytes.
 * Uses OffscreenCanvas + convertToBlob, mirroring the render pattern in
 * src/renderer/src/lib/ocr/render-for-ocr.ts. Browser/webview API dependent.
 */
export async function exportPageImage(
  page: PDFPageProxy,
  opts: ExportImageOptions = {},
): Promise<Uint8Array> {
  const { type = "image/png", quality, scale = 2 } = opts;

  const viewport = page.getViewport({ scale });
  const canvas = new OffscreenCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");

  await page.render({
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;

  const blob = await canvas.convertToBlob({ type, quality });
  return new Uint8Array(await blob.arrayBuffer());
}
