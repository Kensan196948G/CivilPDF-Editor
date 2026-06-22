import { describe, it, expect } from "vitest";
import {
  PDFDocument,
  PDFName,
  PDFHexString,
  PDFString,
  PDFDict,
} from "pdf-lib";
import { readDxDocId, DX_DOCID_INFO_KEY } from "./docid";

async function pdfWithDocId(
  docId: string,
  encoding: "hex" | "literal" = "hex",
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage();
  const context = doc.context;
  let info = context.lookup(context.trailerInfo.Info, PDFDict);
  if (!info) {
    info = context.obj({}) as PDFDict;
    context.trailerInfo.Info = context.register(info);
  }
  const value =
    encoding === "hex" ? PDFHexString.fromText(docId) : PDFString.of(docId);
  info.set(PDFName.of(DX_DOCID_INFO_KEY), value);
  return doc.save();
}

describe("readDxDocId", () => {
  it("reads the embedded DX docId (hex string)", async () => {
    const bytes = await pdfWithDocId("doc-abc-123", "hex");
    expect(await readDxDocId(bytes)).toBe("doc-abc-123");
  });

  it("reads the embedded DX docId (literal string, as pypdf writes ASCII)", async () => {
    // DX embeds via pypdf, which stores ASCII ids as literal PDF strings.
    const bytes = await pdfWithDocId(
      "11111111-2222-3333-4444-555555555555",
      "literal",
    );
    expect(await readDxDocId(bytes)).toBe(
      "11111111-2222-3333-4444-555555555555",
    );
  });

  it("returns null when the PDF has no DX docId", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    expect(await readDxDocId(bytes)).toBeNull();
  });

  it("returns null for non-PDF bytes", async () => {
    expect(await readDxDocId(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });

  it("returns null for an empty docId value", async () => {
    const bytes = await pdfWithDocId("", "hex");
    expect(await readDxDocId(bytes)).toBeNull();
  });
});
