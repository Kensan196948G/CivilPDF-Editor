import { useEffect, useRef, useState } from "react";
import { loadPdf } from "../lib/pdf";

const MAX_PREVIEW_PAGES = 5;

export function PdfViewer({ bytes }: { bytes: Uint8Array }): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    container.replaceChildren();
    setError(null);

    loadPdf(bytes)
      .then(async (doc) => {
        if (cancelled) return;
        setPageCount(doc.numPages);
        const max = Math.min(doc.numPages, MAX_PREVIEW_PAGES);
        for (let n = 1; n <= max; n += 1) {
          const page = await doc.getPage(n);
          const viewport = page.getViewport({ scale: 1.2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.cssText =
            "display:block;margin:0 auto 12px;box-shadow:0 1px 6px rgba(0,0,0,.25)";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          container.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [bytes]);

  return (
    <div>
      {error && <p style={{ color: "crimson" }}>読み込みエラー: {error}</p>}
      {pageCount > MAX_PREVIEW_PAGES && (
        <p style={{ color: "#666", fontSize: 13 }}>
          全 {pageCount} ページ中、先頭 {MAX_PREVIEW_PAGES} ページを表示
        </p>
      )}
      <div ref={containerRef} />
    </div>
  );
}
