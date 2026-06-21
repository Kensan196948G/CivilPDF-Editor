import { PDFDocument, PDFName, PDFHexString, PDFString, PDFDict } from "pdf-lib";
import type { Stamp } from "../types";
import type { Annotation } from "../annotations/types";
import type { ReviewState } from "./schema";
import { REVIEW_INFO_KEY, buildSidecar, parseSidecar } from "./schema";

/**
 * Non-destructive "review save": store the stamps (with review status and
 * history) and annotations as JSON inside the PDF Info dictionary. The visible
 * PDF is NOT modified — no images are drawn — so reopening restores the
 * editable overlay.
 */
export async function saveReviewPdf(
  bytes: Uint8Array,
  stamps: Stamp[],
  annotations: Annotation[],
  savedAt: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const json = JSON.stringify(buildSidecar(stamps, annotations, savedAt));

  const context = doc.context;
  const infoRef = context.trailerInfo.Info;
  let info: PDFDict;
  if (infoRef) {
    info = context.lookup(infoRef, PDFDict);
  } else {
    info = context.obj({}) as PDFDict;
    context.trailerInfo.Info = context.register(info);
  }
  info.set(PDFName.of(REVIEW_INFO_KEY), PDFHexString.fromText(json));

  return doc.save();
}

/** Read the raw review JSON string from a PDF's Info dictionary, if present. */
export async function readReviewRaw(bytes: Uint8Array): Promise<string | null> {
  const doc = await PDFDocument.load(bytes);
  const infoRef = doc.context.trailerInfo.Info;
  if (!infoRef) return null;
  const info = doc.context.lookup(infoRef, PDFDict);
  if (!info) return null;
  const value = info.get(PDFName.of(REVIEW_INFO_KEY));
  if (value instanceof PDFHexString || value instanceof PDFString) {
    return value.decodeText();
  }
  return null;
}

const EMPTY_STATE: ReviewState = { stamps: [], annotations: [] };

/**
 * Restore the overlay saved by {@link saveReviewPdf}. Returns empty state when
 * the PDF has no review sidecar (a plain PDF), so any document opens uniformly.
 */
export async function loadReviewState(bytes: Uint8Array): Promise<ReviewState> {
  const raw = await readReviewRaw(bytes);
  if (!raw) return EMPTY_STATE;
  return parseSidecar(raw) ?? EMPTY_STATE;
}
