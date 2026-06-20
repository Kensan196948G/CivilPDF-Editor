import { PDFDocument } from "pdf-lib";
import type { Stamp } from "./types";
import { toPdfRect } from "./geometry";

/** Decode a PNG data URL into raw bytes. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Flatten stamps into the PDF and return the new document bytes. */
export async function embedStampsIntoPdf(
  originalBytes: Uint8Array,
  stamps: Stamp[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(originalBytes);
  const pages = doc.getPages();

  for (const stamp of stamps) {
    const page = pages[stamp.page];
    if (!page) continue;
    const { width: pw, height: ph } = page.getSize();
    const png = await doc.embedPng(dataUrlToBytes(stamp.src));
    const rect = toPdfRect(stamp, pw, ph);
    page.drawImage(png, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
  }

  return doc.save();
}
