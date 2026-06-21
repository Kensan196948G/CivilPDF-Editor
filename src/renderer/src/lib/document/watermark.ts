import { PDFDocument } from "pdf-lib";

export interface WatermarkOptions {
  text: string;
  opacity?: number;
  fontSize?: number;
  angle?: number;
  color?: string;
}

/**
 * Add a text watermark to every page using canvas rendering.
 * Canvas-based approach supports Japanese and CJK text without font embedding.
 */
export async function addWatermark(
  docBytes: Uint8Array,
  opts: WatermarkOptions,
): Promise<Uint8Array> {
  const { text, opacity = 0.25, fontSize = 60, angle = 45, color = "#888888" } = opts;

  const pdfDoc = await PDFDocument.load(docBytes);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();

    // Render watermark text to transparent canvas (supports CJK via system fonts)
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * 2);
    canvas.height = Math.round(height * 2);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(cx, cy);
    ctx.rotate((-angle * Math.PI) / 180);
    ctx.font = `bold ${fontSize * 2}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 0);
    ctx.restore();

    const pngBytes = await canvasToPngBytes(canvas);
    const img = await pdfDoc.embedPng(pngBytes);

    page.drawImage(img, { x: 0, y: 0, width, height, opacity: 1 });
  }

  return pdfDoc.save();
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      const ab = await blob!.arrayBuffer();
      resolve(new Uint8Array(ab));
    }, "image/png");
  });
}
