import { describe, it, expect, beforeAll } from "vitest";
import { PDFDocument } from "pdf-lib";
import { embedTextLayer } from "./embed-text";
import type { OcrDocumentResult } from "./types";

// Use pdf-lib itself to generate a valid PDF so no cross-context Uint8Array issues arise
let MINIMAL_PDF: Uint8Array;

beforeAll(async () => {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  MINIMAL_PDF = await doc.save();
});

describe("embedTextLayer", () => {
  it("returns bytes longer than the input (text layer added)", async () => {
    const ocrResult: OcrDocumentResult = {
      pages: [
        {
          page: 0,
          lines: [],
          words: [
            { text: "Hello", x: 0.1, y: 0.1, w: 0.2, h: 0.05, confidence: 90 },
            { text: "World", x: 0.1, y: 0.2, w: 0.2, h: 0.05, confidence: 85 },
          ],
          lang: "eng",
          durationMs: 100,
          renderScale: 2,
        },
      ],
      engine: "tesseract.js",
      engineVersion: "5",
      createdAt: "2026-06-21T00:00:00.000Z",
    };

    const result = await embedTextLayer(MINIMAL_PDF, ocrResult);
    expect(result.byteLength).toBeGreaterThan(MINIMAL_PDF.byteLength);
    // Verify PDF header is intact
    expect(new TextDecoder().decode(result.slice(0, 4))).toBe("%PDF");
  });

  it("skips non-ASCII words (Japanese) without error", async () => {
    const ocrResult: OcrDocumentResult = {
      pages: [
        {
          page: 0,
          lines: [],
          words: [
            { text: "図面", x: 0.1, y: 0.1, w: 0.2, h: 0.05, confidence: 85 },
          ],
          lang: "jpn",
          durationMs: 200,
          renderScale: 2,
        },
      ],
      engine: "tesseract.js",
      engineVersion: "5",
      createdAt: "2026-06-21T00:00:00.000Z",
    };
    await expect(embedTextLayer(MINIMAL_PDF, ocrResult)).resolves.toBeInstanceOf(Uint8Array);
  });

  it("handles empty OCR result gracefully", async () => {
    const emptyResult: OcrDocumentResult = {
      pages: [],
      engine: "tesseract.js",
      engineVersion: "5",
      createdAt: "2026-06-21T00:00:00.000Z",
    };
    const result = await embedTextLayer(MINIMAL_PDF, emptyResult);
    expect(result.byteLength).toBeGreaterThan(0);
  });
});
