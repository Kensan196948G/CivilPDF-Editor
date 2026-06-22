import {
  PDFDocument,
  PDFName,
  PDFHexString,
  PDFString,
  PDFDict,
} from "pdf-lib";

// Key written by CivilPDF-DX into the PDF Info dict on download
// (api/documents.py: /CivilPdfDxDocId). Reading it back lets the Editor target
// the correct DX document when syncing a ReviewSidecar — no manual entry or
// server lookup required.
export const DX_DOCID_INFO_KEY = "CivilPdfDxDocId";

/**
 * Read the DX document id embedded in a PDF's Info dictionary, or null when the
 * PDF was not distributed by DX (or is unreadable). Both literal and hex PDF
 * string encodings are accepted (DX writes via pypdf; the Editor via pdf-lib).
 * Mirrors the review-sidecar round-trip in lib/review/persist.ts.
 */
export async function readDxDocId(bytes: Uint8Array): Promise<string | null> {
  try {
    const doc = await PDFDocument.load(bytes);
    const infoRef = doc.context.trailerInfo.Info;
    if (!infoRef) return null;
    const info = doc.context.lookup(infoRef, PDFDict);
    if (!info) return null;
    const value = info.get(PDFName.of(DX_DOCID_INFO_KEY));
    if (value instanceof PDFHexString || value instanceof PDFString) {
      const text = value.decodeText();
      return text.length > 0 ? text : null;
    }
    return null;
  } catch {
    return null;
  }
}
