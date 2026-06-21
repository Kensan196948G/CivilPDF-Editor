import { PDFDocument } from "pdf-lib";

export interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
}

/** Read basic metadata from a PDF's Info dictionary. */
export async function readPdfMetadata(docBytes: Uint8Array): Promise<PdfMetadata> {
  const pdfDoc = await PDFDocument.load(docBytes, { ignoreEncryption: true });
  return {
    title: pdfDoc.getTitle() ?? "",
    author: pdfDoc.getAuthor() ?? "",
    subject: pdfDoc.getSubject() ?? "",
    keywords: (pdfDoc.getKeywords() ?? ""),
    creator: pdfDoc.getCreator() ?? "",
  };
}

/** Write metadata fields back into the PDF bytes. */
export async function updatePdfMetadata(
  docBytes: Uint8Array,
  meta: PdfMetadata,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(docBytes);
  pdfDoc.setTitle(meta.title);
  pdfDoc.setAuthor(meta.author);
  pdfDoc.setSubject(meta.subject);
  pdfDoc.setKeywords(
    meta.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  );
  pdfDoc.setCreator(meta.creator);
  return pdfDoc.save();
}
