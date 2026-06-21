import { PDFDocument, rgb } from "pdf-lib";

export type ImageMime = "image/png" | "image/jpeg";

export interface ImageEntry {
  bytes: Uint8Array;
  mime: ImageMime;
}

export type PageSizePreset = "A4" | "A3" | "fit";

export interface ImageToPdfOptions {
  images: ImageEntry[];
  pageSize?: PageSizePreset;
  margin?: number; // points
}

const PAGE_SIZES: Record<Exclude<PageSizePreset, "fit">, [number, number]> = {
  A4: [595.28, 841.89],
  A3: [841.89, 1190.55],
};

export async function imagesToPdf(opts: ImageToPdfOptions): Promise<Uint8Array> {
  const { images, pageSize = "A4", margin = 20 } = opts;
  if (images.length === 0) throw new Error("No images provided");

  const pdf = await PDFDocument.create();

  for (const img of images) {
    const embedded =
      img.mime === "image/png"
        ? await pdf.embedPng(img.bytes)
        : await pdf.embedJpg(img.bytes);

    let pageW: number, pageH: number;
    if (pageSize === "fit") {
      pageW = embedded.width;
      pageH = embedded.height;
    } else {
      const preset = PAGE_SIZES[pageSize];
      // Rotate to landscape if image is wider than tall
      const isLandscape = embedded.width > embedded.height;
      [pageW, pageH] = isLandscape ? [preset[1], preset[0]] : preset;
    }

    const page = pdf.addPage([pageW, pageH]);
    page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(1, 1, 1) });

    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;
    const { width, height } = embedded.scaleToFit(availW, availH);
    const x = margin + (availW - width) / 2;
    const y = margin + (availH - height) / 2;

    page.drawImage(embedded, { x, y, width, height });
  }

  return pdf.save();
}
