import { describe, it, expect, beforeAll } from "vitest";
import { buildDocx } from "./build-docx";
import type { ExtractedDoc } from "./extract-text";

// jsdom's Blob lacks arrayBuffer(); add a FileReader-based polyfill for tests only.
// Production code (build-docx.ts) keeps using Packer.toBlob() for webview compatibility,
// where the runtime Blob already implements arrayBuffer().
beforeAll(() => {
  if (typeof Blob !== "undefined" && typeof Blob.prototype.arrayBuffer !== "function") {
    Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
});

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

describe("buildDocx", () => {
  it("produces a ZIP-magic (PK\\x03\\x04) Uint8Array", async () => {
    const doc: ExtractedDoc = {
      pages: [{ index: 0, lines: [{ text: "Hello", x: 10, y: 100 }] }],
      source: "pdf-text",
    };
    const out = await buildDocx(doc);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out.slice(0, 4))).toEqual(ZIP_MAGIC);
  });

  it("generates a document containing Japanese text without throwing", async () => {
    const doc: ExtractedDoc = {
      pages: [
        {
          index: 0,
          lines: [
            { text: "図面番号 A-101", x: 0, y: 200 },
            { text: "縮尺 1:100", x: 0, y: 180 },
          ],
        },
        {
          index: 1,
          lines: [{ text: "構造図 鉄筋コンクリート造", x: 0, y: 200 }],
        },
      ],
      source: "mixed",
    };
    const out = await buildDocx(doc);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out.slice(0, 4))).toEqual(ZIP_MAGIC);
    expect(out.byteLength).toBeGreaterThan(0);
  });

  it("handles an empty document without throwing", async () => {
    const doc: ExtractedDoc = { pages: [], source: "pdf-text" };
    const out = await buildDocx(doc);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out.slice(0, 4))).toEqual(ZIP_MAGIC);
  });
});
