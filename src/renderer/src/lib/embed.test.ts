import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { dataUrlToBytes, embedStampsIntoPdf } from "./embed";
import type { Stamp } from "./types";

// 1×1 red pixel PNG
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";

async function makeOnePage(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  return doc.save();
}

describe("dataUrlToBytes", () => {
  it("decodes PNG data URL — PNG magic bytes 0x89 0x50 0x4E 0x47 present", () => {
    const bytes = dataUrlToBytes(TINY_PNG);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x4e);
    expect(bytes[3]).toBe(0x47);
  });

  it("returns zero-length Uint8Array when base64 segment is empty", () => {
    const bytes = dataUrlToBytes("data:image/png;base64,");
    expect(bytes.length).toBe(0);
  });
});

describe("embedStampsIntoPdf", () => {
  it("returns valid PDF with no stamps (magic bytes %PDF)", async () => {
    const src = await makeOnePage();
    const out = await embedStampsIntoPdf(src, []);
    expect(out[0]).toBe(0x25); // %
    expect(out[1]).toBe(0x50); // P
    expect(out[2]).toBe(0x44); // D
    expect(out[3]).toBe(0x46); // F
  });

  it("output is larger with stamp embedded and page count unchanged", async () => {
    const src = await makeOnePage();
    const stamp: Stamp = {
      id: "s1",
      page: 0,
      x: 0.1,
      y: 0.1,
      w: 0.15,
      ratio: 1,
      src: TINY_PNG,
    };
    const out = await embedStampsIntoPdf(src, [stamp]);
    expect(out.length).toBeGreaterThan(src.length);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(1);
  });

  it("out-of-range page index is silently ignored — no throw, valid PDF", async () => {
    const src = await makeOnePage(); // 1 page → index 0 only
    const stamp: Stamp = {
      id: "s-oob",
      page: 99,
      x: 0.5,
      y: 0.5,
      w: 0.15,
      ratio: 1,
      src: TINY_PNG,
    };
    const out = await embedStampsIntoPdf(src, [stamp]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(1);
  });
});
