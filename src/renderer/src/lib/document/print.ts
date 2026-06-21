import type { PDFPageProxy } from "pdfjs-dist";

const PRINT_DPI = 150;
const PDF_POINTS_PER_INCH = 72;

/**
 * Render one page to a PNG data URL at print resolution. Large-format drawings
 * are tiled on screen, so printing the live DOM would lose off-screen tiles;
 * we render each page fresh at a controlled DPI instead.
 */
export async function renderPageToDataUrl(
  page: PDFPageProxy,
  dpi = PRINT_DPI,
): Promise<string> {
  const scale = dpi / PDF_POINTS_PER_INCH;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png");
}

const PRINT_STYLE = `
  @media print {
    body > *:not(.civilpdf-print-root) { display: none !important; }
    .civilpdf-print-root { display: block !important; }
    .civilpdf-print-page { display: block; width: 100%; page-break-after: always; }
  }
  @media screen { .civilpdf-print-root { display: none; } }
`;

/**
 * Build a hidden print-only container with each page as a full-width image and
 * invoke the OS print dialog. Page range is handled by the OS dialog. The
 * container is cleaned up after printing.
 */
export async function printDocument(pages: PDFPageProxy[]): Promise<void> {
  if (pages.length === 0) return;

  const urls: string[] = [];
  for (const page of pages) urls.push(await renderPageToDataUrl(page));

  const style = document.createElement("style");
  style.textContent = PRINT_STYLE;
  const container = document.createElement("div");
  container.className = "civilpdf-print-root";
  for (const url of urls) {
    const img = document.createElement("img");
    img.src = url;
    img.className = "civilpdf-print-page";
    container.appendChild(img);
  }
  document.body.appendChild(style);
  document.body.appendChild(container);

  const cleanup = (): void => {
    container.remove();
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  try {
    window.print();
  } catch (e) {
    cleanup();
    throw e;
  }
  // Fallback cleanup in case afterprint never fires (some WebKit builds).
  window.setTimeout(cleanup, 60_000);
}
