import type { PDFPageProxy } from "pdfjs-dist";
import type { Stamp } from "../types";
import type { Annotation } from "../annotations/types";
import type { OcrDocumentResult } from "../ocr/types";

/** Maps an old page index to its new index, or null if the page was removed. */
export type PageIndexMap = (oldIndex: number) => number | null;

/**
 * Central document state shared by every feature area (shell, review,
 * editing, export). A single reducer owns it so that the `dirty` flag and
 * page-index remapping live in exactly one place.
 */
export interface DocumentState {
  filePath: string | null; // full path on disk; null until first save of a new doc
  fileName: string | null; // display name
  docBytes: Uint8Array | null; // current edited bytes (source of truth for pdf-lib + pdfjs)
  pages: PDFPageProxy[]; // derived from docBytes (display)
  stamps: Stamp[];
  annotations: Annotation[];
  ocrResult: OcrDocumentResult | null;
  selectedId: string | null; // selected stamp/annotation for review highlighting
  dirty: boolean; // unsaved changes
  busy: boolean;
  scale: number;
  revision: number; // bumped on structural page edits to invalidate tile cache
}

export type DocumentAction =
  | {
      type: "OPEN_SUCCESS";
      filePath: string;
      fileName: string;
      docBytes: Uint8Array;
      pages: PDFPageProxy[];
      stamps: Stamp[]; // restored from review round-trip, or []
    }
  | {
      type: "PAGE_EDIT";
      docBytes: Uint8Array;
      pages: PDFPageProxy[];
      remap: PageIndexMap;
    }
  | { type: "ADD_STAMP"; stamp: Stamp }
  | { type: "UPDATE_STAMP"; id: string; partial: Partial<Pick<Stamp, "x" | "y" | "w">> }
  | { type: "REMOVE_STAMP"; id: string }
  | { type: "APPROVE"; id: string; actor: string; at: string; comment?: string }
  | { type: "REJECT"; id: string; actor: string; at: string; comment?: string }
  | { type: "COMMENT"; id: string; actor: string; at: string; comment: string }
  | { type: "ADD_ANNOT"; annot: Annotation }
  | { type: "REMOVE_ANNOT"; id: string }
  | { type: "APPLY_OCR"; result: OcrDocumentResult }
  | { type: "SELECT"; id: string | null }
  | { type: "SAVED"; filePath: string; fileName: string }
  | { type: "SET_SCALE"; scale: number }
  | { type: "SET_BUSY"; busy: boolean };

export const DEFAULT_DOCUMENT_SCALE = 1.2;

export function initialDocumentState(scale = DEFAULT_DOCUMENT_SCALE): DocumentState {
  return {
    filePath: null,
    fileName: null,
    docBytes: null,
    pages: [],
    stamps: [],
    annotations: [],
    ocrResult: null,
    selectedId: null,
    dirty: false,
    busy: false,
    scale,
    revision: 0,
  };
}
