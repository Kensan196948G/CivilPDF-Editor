import { writeFile } from "@tauri-apps/plugin-fs";
import { save as dialogSave } from "@tauri-apps/plugin-dialog";
import type { Stamp } from "../types";
import type { Annotation } from "../annotations/types";
import type { OcrDocumentResult } from "../ocr/types";
import { saveReviewPdf } from "../review/persist";
import { embedStampsIntoPdf, type EmbedOptions } from "../embed";
import { embedAnnotationsIntoPdf } from "../annotations/embed-annot";
import { embedTextLayer } from "../ocr/embed-text";

/** The slice of document state needed to produce output bytes. */
export interface OutputSource {
  docBytes: Uint8Array;
  stamps: Stamp[];
  annotations: Annotation[];
  ocrResult: OcrDocumentResult | null;
}

/**
 * Non-destructive "review save": embed the editable overlay (stamps with
 * review status, annotations) as JSON metadata. Reopening restores it.
 */
export function buildReviewBytes(
  src: OutputSource,
  savedAt: string,
): Promise<Uint8Array> {
  return saveReviewPdf(src.docBytes, src.stamps, src.annotations, savedAt);
}

/**
 * Destructive "finalize" save: bake stamps, annotations and the OCR text layer
 * into the PDF, producing a flattened, non-editable deliverable.
 */
export async function buildFinalizedBytes(
  src: OutputSource,
  opts: EmbedOptions = {},
): Promise<Uint8Array> {
  let bytes = src.docBytes;
  if (src.stamps.length > 0) bytes = await embedStampsIntoPdf(bytes, src.stamps, opts);
  if (src.annotations.length > 0) bytes = await embedAnnotationsIntoPdf(bytes, src.annotations);
  if (src.ocrResult) bytes = await embedTextLayer(bytes, src.ocrResult);
  return bytes;
}

/** Write bytes to a known path (overwrite, no dialog). */
export function writeToPath(path: string, bytes: Uint8Array): Promise<void> {
  return writeFile(path, bytes);
}

/** Prompt for a save path; returns the chosen path or null if cancelled. */
export async function pickSavePath(
  defaultName: string,
  extension = "pdf",
  label = "PDF",
): Promise<string | null> {
  const path = await dialogSave({
    defaultPath: defaultName,
    filters: [{ name: label, extensions: [extension] }],
  });
  return (path as string | null) ?? null;
}

/** Replace a path's extension (e.g. "a.pdf" -> "a.docx"). */
export function withExtension(name: string, ext: string): string {
  return name.replace(/\.[^./\\]+$/, "") + "." + ext;
}
