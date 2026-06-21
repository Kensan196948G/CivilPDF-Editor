import type { PDFPageProxy } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { OcrDocumentResult } from "../ocr/types";

/** A single extracted text line. `y` uses PDF user-space (bottom-left origin). */
export interface ExtractedLine {
  text: string;
  y: number;
  x: number;
}

export interface ExtractedPage {
  index: number;
  lines: ExtractedLine[];
}

export interface ExtractedDoc {
  pages: ExtractedPage[];
  source: "pdf-text" | "ocr" | "mixed";
}

/** Minimal pdfjs-item-shaped input for the pure clustering function. `y` is bottom-left origin. */
interface RawItem {
  str: string;
  x: number;
  y: number;
}

const DEFAULT_Y_TOLERANCE = 2;

/**
 * Pure (pdfjs-independent) line clustering.
 * Groups items whose `y` is within ±yTolerance into the same line, concatenates the
 * line's strings in ascending `x` order, and returns lines sorted top→bottom (y descending).
 */
export function clusterLines(
  items: RawItem[],
  yTolerance: number = DEFAULT_Y_TOLERANCE,
): ExtractedLine[] {
  if (items.length === 0) return [];

  interface Cluster {
    items: RawItem[];
    yRef: number;
  }
  const clusters: Cluster[] = [];

  for (const item of items) {
    let target: Cluster | undefined;
    for (const cluster of clusters) {
      if (Math.abs(cluster.yRef - item.y) <= yTolerance) {
        target = cluster;
        break;
      }
    }
    if (target) {
      target.items.push(item);
    } else {
      clusters.push({ items: [item], yRef: item.y });
    }
  }

  const lines: ExtractedLine[] = clusters.map((cluster) => {
    const sorted = [...cluster.items].sort((a, b) => a.x - b.x);
    const text = sorted.map((it) => it.str).join("");
    return {
      text,
      x: sorted[0].x,
      y: cluster.yRef,
    };
  });

  // Top→bottom: PDF user-space y descending.
  lines.sort((a, b) => b.y - a.y);
  return lines;
}

/** Convert an OcrDocumentResult page's lines into ExtractedLine[] (page-relative fallback). */
function ocrPageToLines(
  ocr: OcrDocumentResult,
  pageIndex: number,
): ExtractedLine[] | null {
  const ocrPage = ocr.pages.find((p) => p.page === pageIndex);
  if (!ocrPage || ocrPage.lines.length === 0) return null;
  // OCR coordinates are 0..1 top-left origin; emit synthetic descending y so the
  // top→bottom order is preserved relative to the OCR line ordering.
  return ocrPage.lines.map((line, i) => ({
    text: line.text,
    x: 0,
    y: ocrPage.lines.length - i,
  }));
}

/**
 * Extract text from pdfjs pages, falling back to OCR for pages with no embedded text.
 * Each page's `getTextContent()` items become {str, x, y} and are clustered into lines.
 */
export async function extractPdfText(
  pages: PDFPageProxy[],
  ocr?: OcrDocumentResult,
): Promise<ExtractedDoc> {
  const extractedPages: ExtractedPage[] = [];
  let usedPdfText = false;
  let usedOcr = false;

  for (let index = 0; index < pages.length; index++) {
    const page = pages[index];
    const content = await page.getTextContent();
    const rawItems: RawItem[] = content.items
      .filter((item): item is TextItem => "str" in item && "transform" in item)
      .map((item) => ({
        str: item.str,
        x: item.transform[4] as number,
        y: item.transform[5] as number,
      }));

    const hasText = rawItems.some((it) => it.str.trim().length > 0);

    if (hasText) {
      extractedPages.push({ index, lines: clusterLines(rawItems) });
      usedPdfText = true;
      continue;
    }

    const ocrLines = ocr ? ocrPageToLines(ocr, index) : null;
    if (ocrLines) {
      extractedPages.push({ index, lines: ocrLines });
      usedOcr = true;
    } else {
      extractedPages.push({ index, lines: [] });
    }
  }

  let source: ExtractedDoc["source"] = "pdf-text";
  if (usedPdfText && usedOcr) source = "mixed";
  else if (usedOcr) source = "ocr";

  return { pages: extractedPages, source };
}
