/** 1 word recognition result. All coordinates are page-relative fractions (0..1), top-left origin. */
export interface OcrWord {
  text: string;
  x: number;        // left   (0..1)
  y: number;        // top    (0..1)
  w: number;        // width  (0..1)
  h: number;        // height (0..1)
  confidence: number; // 0..100
}

export interface OcrLine {
  words: OcrWord[];
  text: string;
}

export interface OcrPageResult {
  page: number;      // 0-based
  lines: OcrLine[];
  words: OcrWord[];  // flattened (for search/embed)
  lang: string;
  durationMs: number;
  renderScale: number; // scale used when rendering for OCR
}

export interface OcrDocumentResult {
  pages: OcrPageResult[];
  engine: "tesseract.js";
  engineVersion: string;
  createdAt: string; // ISO 8601
}

export interface OcrProgress {
  pageIndex: number;
  totalPages: number;
  status: string;
  progress: number; // 0..1
}
