import { Document, Packer, Paragraph, TextRun, PageBreak } from "docx";
import type { ExtractedDoc } from "./extract-text";

/**
 * Build a .docx file from an ExtractedDoc.
 * Each page's lines become Paragraph(TextRun); a PageBreak is appended after each
 * page except the last. Uses Packer.toBlob() for webview compatibility.
 */
export async function buildDocx(doc: ExtractedDoc): Promise<Uint8Array> {
  const children: Paragraph[] = [];

  doc.pages.forEach((page, pageIdx) => {
    for (const line of page.lines) {
      children.push(
        new Paragraph({ children: [new TextRun(line.text)] }),
      );
    }
    const isLastPage = pageIdx === doc.pages.length - 1;
    if (!isLastPage) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  const d = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(d);
  return new Uint8Array(await blob.arrayBuffer());
}
