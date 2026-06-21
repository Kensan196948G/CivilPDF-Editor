import { createWorker } from "tesseract.js";
import type { PDFPageProxy } from "pdfjs-dist";
import type { OcrPageResult, OcrDocumentResult, OcrProgress } from "./types";
import { normalizeWord, buildLine } from "./normalize";
import { renderPageForOcr, OCR_SCALE } from "./render-for-ocr";

export type OcrLang = "jpn" | "jpn_vert" | "eng";

export interface OcrOptions {
  langs?: OcrLang[];
  scale?: number;
  onProgress?: (p: OcrProgress) => void;
}

/**
 * Recognize a single PDF page. Returns OcrPageResult with fraction-normalized words.
 */
export async function recognizePage(
  page: PDFPageProxy,
  pageIndex: number,
  options: OcrOptions = {},
): Promise<OcrPageResult> {
  const langs = options.langs ?? ["jpn", "eng"];
  const scale = options.scale ?? OCR_SCALE;
  const t0 = Date.now();

  const { canvas, width, height } = await renderPageForOcr(page, scale);

  const worker = await createWorker(langs.join("+"), 1, {
    logger: (m: { status: string; progress: number }) => {
      options.onProgress?.({
        pageIndex,
        totalPages: 1,
        status: m.status,
        progress: m.progress,
      });
    },
  });

  try {
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const { data } = await worker.recognize(blob);

    const words = (data.words ?? [])
      .filter((w) => w.text.trim().length > 0)
      .map((w) =>
        normalizeWord(
          w.text,
          { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 },
          w.confidence,
          width,
          height,
        ),
      );

    // Group into lines by shared baseline proximity
    const lineMap = new Map<number, typeof words>();
    for (const w of words) {
      const lineKey = Math.round(w.y * 1000);
      const group = lineMap.get(lineKey) ?? [];
      group.push(w);
      lineMap.set(lineKey, group);
    }
    const lines = Array.from(lineMap.values()).map(buildLine);

    return {
      page: pageIndex,
      lines,
      words,
      lang: langs.join("+"),
      durationMs: Date.now() - t0,
      renderScale: scale,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Recognize all pages in a PDF document sequentially.
 */
export async function recognizeDocument(
  pages: PDFPageProxy[],
  options: OcrOptions = {},
): Promise<OcrDocumentResult> {
  const results: OcrPageResult[] = [];

  for (let i = 0; i < pages.length; i++) {
    const result = await recognizePage(pages[i], i, {
      ...options,
      onProgress: (p) =>
        options.onProgress?.({ ...p, pageIndex: i, totalPages: pages.length }),
    });
    results.push(result);
  }

  return {
    pages: results,
    engine: "tesseract.js",
    engineVersion: "5",
    createdAt: new Date().toISOString(),
  };
}
