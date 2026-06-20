import * as pdfjsLib from "pdfjs-dist";
// Vite bundles the pdf.js worker as a dedicated worker module.
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

/** Parse PDF bytes into a pdf.js document proxy. */
export function loadPdf(bytes: Uint8Array): Promise<pdfjsLib.PDFDocumentProxy> {
  return pdfjsLib.getDocument({ data: bytes }).promise;
}
