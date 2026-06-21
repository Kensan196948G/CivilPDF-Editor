import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  rotatePages,
  deletePages,
  reorderPages,
  insertBlankPage,
  insertPagesFrom,
  mergePdfs,
  splitPdf,
} from "./page-ops";

/**
 * Build an `n`-page PDF where each page draws its own index as text, so pages
 * can be told apart by content after structural edits.
 */
async function makeNumberedPdf(
  n: number,
  size: [number, number] = [612, 792],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < n; i += 1) {
    const page = doc.addPage(size);
    page.drawText(String(i), { x: 20, y: 20, size: 24, font });
  }
  return doc.save();
}

/** Assert the bytes begin with the `%PDF` magic header. */
function expectPdfMagic(bytes: Uint8Array): void {
  expect(bytes[0]).toBe(0x25); // %
  expect(bytes[1]).toBe(0x50); // P
  expect(bytes[2]).toBe(0x44); // D
  expect(bytes[3]).toBe(0x46); // F
}

describe("rotatePages", () => {
  it("adds the delta to a page's current rotation", async () => {
    const src = await makeNumberedPdf(2);
    const out = await rotatePages(src, [0], 90);
    const doc = await PDFDocument.load(out);
    expect(doc.getPages()[0].getRotation().angle).toBe(90);
    expect(doc.getPages()[1].getRotation().angle).toBe(0);
  });

  it("normalises values over 360 (270 + 180 -> 90)", async () => {
    const src = await makeNumberedPdf(1);
    const once = await rotatePages(src, [0], 270);
    const twice = await rotatePages(once, [0], 180);
    const doc = await PDFDocument.load(twice);
    expect(doc.getPages()[0].getRotation().angle).toBe(90);
  });

  it("normalises negative deltas (-90 -> 270)", async () => {
    const src = await makeNumberedPdf(1);
    const out = await rotatePages(src, [0], -90);
    const doc = await PDFDocument.load(out);
    expect(doc.getPages()[0].getRotation().angle).toBe(270);
  });

  it("ignores out-of-range indices and stays a valid PDF", async () => {
    const src = await makeNumberedPdf(1);
    const out = await rotatePages(src, [0, 99], 90);
    expectPdfMagic(out);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPages()[0].getRotation().angle).toBe(90);
  });
});

describe("deletePages", () => {
  it("reduces the page count and remaps survivors", async () => {
    const src = await makeNumberedPdf(4);
    const { bytes, map } = await deletePages(src, [1]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);

    // Page 1 removed; 0 stays, 2 -> 1, 3 -> 2.
    expect(map(0)).toBe(0);
    expect(map(1)).toBeNull();
    expect(map(2)).toBe(1);
    expect(map(3)).toBe(2);
  });

  it("handles multiple deletions in any order", async () => {
    const src = await makeNumberedPdf(5);
    const { bytes, map } = await deletePages(src, [3, 0]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);

    expect(map(0)).toBeNull();
    expect(map(1)).toBe(0);
    expect(map(2)).toBe(1);
    expect(map(3)).toBeNull();
    expect(map(4)).toBe(2);
  });

  it("produces a valid PDF", async () => {
    const src = await makeNumberedPdf(3);
    const { bytes } = await deletePages(src, [0]);
    expectPdfMagic(bytes);
  });
});

describe("reorderPages", () => {
  it("keeps the page count and reflects the new order in the map", async () => {
    const src = await makeNumberedPdf(3);
    const { bytes, map } = await reorderPages(src, [2, 0, 1]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);

    // newOrder[k] = old index now at position k → map(old) = position.
    expect(map(2)).toBe(0);
    expect(map(0)).toBe(1);
    expect(map(1)).toBe(2);
  });

  it("produces a valid PDF", async () => {
    const src = await makeNumberedPdf(2);
    const { bytes } = await reorderPages(src, [1, 0]);
    expectPdfMagic(bytes);
  });
});

describe("insertBlankPage", () => {
  it("adds one page and stays a valid PDF", async () => {
    const src = await makeNumberedPdf(2);
    const out = await insertBlankPage(src, 1);
    expectPdfMagic(out);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(3);
  });

  it("uses an explicit size when provided", async () => {
    const src = await makeNumberedPdf(1, [612, 792]);
    const out = await insertBlankPage(src, 0, [200, 400]);
    const doc = await PDFDocument.load(out);
    const { width, height } = doc.getPages()[0].getSize();
    expect(width).toBeCloseTo(200);
    expect(height).toBeCloseTo(400);
  });

  it("copies the neighbour's size by default", async () => {
    const src = await makeNumberedPdf(1, [300, 500]);
    const out = await insertBlankPage(src, 1); // neighbour = page 0 (300x500)
    const doc = await PDFDocument.load(out);
    const { width, height } = doc.getPages()[1].getSize();
    expect(width).toBeCloseTo(300);
    expect(height).toBeCloseTo(500);
  });
});

describe("insertPagesFrom", () => {
  it("inserts the selected source pages at the index", async () => {
    const target = await makeNumberedPdf(2);
    const source = await makeNumberedPdf(3);
    const out = await insertPagesFrom(target, source, [0, 2], 1);
    expectPdfMagic(out);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(4); // 2 + 2 inserted
  });

  it('supports "all" to copy every source page', async () => {
    const target = await makeNumberedPdf(1);
    const source = await makeNumberedPdf(3);
    const out = await insertPagesFrom(target, source, "all", 1);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(4); // 1 + 3
  });
});

describe("mergePdfs", () => {
  it("concatenates documents and stays valid", async () => {
    const a = await makeNumberedPdf(2);
    const b = await makeNumberedPdf(3);
    const out = await mergePdfs([a, b]);
    expectPdfMagic(out);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(5);
  });

  it("returns a valid PDF for no parts", async () => {
    const out = await mergePdfs([]);
    expectPdfMagic(out);
    // pdf-lib materialises a placeholder page when an empty document is saved,
    // so we only assert the output is a loadable PDF here.
    await expect(PDFDocument.load(out)).resolves.toBeTruthy();
  });
});

describe("splitPdf", () => {
  it("produces one valid document per inclusive range", async () => {
    const src = await makeNumberedPdf(5);
    const parts = await splitPdf(src, [
      { start: 0, end: 1 },
      { start: 2, end: 4 },
    ]);
    expect(parts).toHaveLength(2);
    for (const part of parts) expectPdfMagic(part);

    const first = await PDFDocument.load(parts[0]);
    const second = await PDFDocument.load(parts[1]);
    expect(first.getPageCount()).toBe(2);
    expect(second.getPageCount()).toBe(3);
  });

  it("clamps out-of-range bounds to the available pages", async () => {
    const src = await makeNumberedPdf(3);
    const parts = await splitPdf(src, [{ start: 1, end: 99 }]);
    const doc = await PDFDocument.load(parts[0]);
    expect(doc.getPageCount()).toBe(2); // pages 1 and 2
  });
});
