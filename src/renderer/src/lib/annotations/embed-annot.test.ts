import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { embedAnnotationsIntoPdf, hexToRgb } from "./embed-annot";
import type { Annotation } from "./types";

/** Build a plain 2-page PDF for embedding tests. */
async function makeTwoPagePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  doc.addPage([612, 792]);
  return doc.save();
}

/** Assert the bytes begin with the `%PDF` magic header. */
function expectPdfMagic(bytes: Uint8Array): void {
  expect(bytes[0]).toBe(0x25); // %
  expect(bytes[1]).toBe(0x50); // P
  expect(bytes[2]).toBe(0x44); // D
  expect(bytes[3]).toBe(0x46); // F
}

const ALL_KINDS: Annotation[] = [
  {
    id: "h1",
    page: 0,
    color: "#ffeb3b",
    kind: "highlight",
    rects: [{ x: 0.1, y: 0.1, w: 0.3, h: 0.05 }],
  },
  {
    id: "u1",
    page: 0,
    color: "#2196f3",
    kind: "underline",
    rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.05 }],
  },
  {
    id: "s1",
    page: 1,
    color: "#f44336",
    kind: "strikeout",
    rects: [{ x: 0.1, y: 0.3, w: 0.3, h: 0.05 }],
  },
  {
    id: "n1",
    page: 1,
    color: "#4caf50",
    kind: "note",
    x: 0.5,
    y: 0.5,
    text: "現場確認済み", // non-ASCII: kept in the editable layer, not burned
  },
  {
    id: "i1",
    page: 0,
    color: "#9c27b0",
    kind: "ink",
    width: 0.004,
    strokes: [
      [
        { x: 0.1, y: 0.6 },
        { x: 0.2, y: 0.65 },
        { x: 0.3, y: 0.6 },
      ],
    ],
  },
];

describe("hexToRgb", () => {
  it("parses #rrggbb", () => {
    expect(hexToRgb("#ff0000")).toEqual({ type: "RGB", red: 1, green: 0, blue: 0 });
  });

  it("parses shorthand #rgb", () => {
    expect(hexToRgb("#0f0")).toEqual({ type: "RGB", red: 0, green: 1, blue: 0 });
  });

  it("falls back to black for malformed input", () => {
    expect(hexToRgb("not-a-color")).toEqual({ type: "RGB", red: 0, green: 0, blue: 0 });
  });
});

describe("embedAnnotationsIntoPdf", () => {
  it("returns a valid PDF with no annotations", async () => {
    const src = await makeTwoPagePdf();
    const out = await embedAnnotationsIntoPdf(src, []);
    expectPdfMagic(out);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
  });

  it("burns every annotation kind, keeping page count and growing in size", async () => {
    const src = await makeTwoPagePdf();
    const out = await embedAnnotationsIntoPdf(src, ALL_KINDS);
    expectPdfMagic(out);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
    expect(out.length).toBeGreaterThan(src.length);
  });

  it("ignores annotations on out-of-range pages", async () => {
    const src = await makeTwoPagePdf();
    const offPage: Annotation = {
      id: "oob",
      page: 99,
      color: "#000000",
      kind: "highlight",
      rects: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.05 }],
    };
    const out = await embedAnnotationsIntoPdf(src, [offPage]);
    expectPdfMagic(out);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
  });

  it("only embeds the font when a note is present", async () => {
    const src = await makeTwoPagePdf();
    const withoutNote = ALL_KINDS.filter((a) => a.kind !== "note");
    const noNote = await embedAnnotationsIntoPdf(src, withoutNote);
    const withNote = await embedAnnotationsIntoPdf(src, ALL_KINDS);
    // A note adds a marker plus the embedded Helvetica font program.
    expect(withNote.length).toBeGreaterThan(noNote.length);
  });
});
