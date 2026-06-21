import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type HfAlign = "left" | "center" | "right";

export interface HfConfig {
  headerText?: string;
  footerText?: string;
  fontSize?: number;
  align?: HfAlign;
  marginX?: number; // points from edge
  marginY?: number; // points from top/bottom edge
}

function resolveText(template: string, page: number, total: number): string {
  return template.replace(/\{n\}/g, String(page)).replace(/\{total\}/g, String(total));
}

function calcX(text: string, pageWidth: number, fontSize: number, align: HfAlign, marginX: number): number {
  const charW = fontSize * 0.5; // rough monospace estimate
  const textW = text.length * charW;
  if (align === "left") return marginX;
  if (align === "right") return pageWidth - marginX - textW;
  return (pageWidth - textW) / 2;
}

export async function applyHeaderFooter(
  docBytes: Uint8Array,
  config: HfConfig,
): Promise<Uint8Array> {
  const { headerText, footerText, fontSize = 10, align = "center", marginX = 40, marginY = 20 } = config;
  if (!headerText && !footerText) return docBytes;

  const pdf = await PDFDocument.load(docBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const total = pages.length;

  pages.forEach((page, i) => {
    const { width, height } = page.getSize();
    const pageNum = i + 1;

    if (headerText) {
      const text = resolveText(headerText, pageNum, total);
      const x = calcX(text, width, fontSize, align, marginX);
      page.drawText(text, { x, y: height - marginY, size: fontSize, font, color: rgb(0.2, 0.2, 0.2) });
    }

    if (footerText) {
      const text = resolveText(footerText, pageNum, total);
      const x = calcX(text, width, fontSize, align, marginX);
      page.drawText(text, { x, y: marginY, size: fontSize, font, color: rgb(0.2, 0.2, 0.2) });
    }
  });

  return pdf.save();
}
