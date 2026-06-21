import { useState, useRef } from "react";
import type { PDFPageProxy } from "pdfjs-dist";
import { recognizePage } from "../lib/ocr/ocr-client";
import { embedTextLayer } from "../lib/ocr/embed-text";
import type { OcrDocumentResult, OcrPageResult, OcrProgress } from "../lib/ocr/types";
import { save as dialogSave } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

interface OcrPanelProps {
  pages: PDFPageProxy[];
  originalBytes: Uint8Array;
}

type Phase = "idle" | "running" | "done" | "cancelled" | "error";

export function OcrPanel({ pages, originalBytes }: OcrPanelProps): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [pageResults, setPageResults] = useState<OcrPageResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const totalPages = pages.length;

  const handleStart = async (): Promise<void> => {
    cancelRef.current = false;
    setPhase("running");
    setProgress(null);
    setPageResults([]);
    setError(null);

    const results: OcrPageResult[] = [];

    try {
      for (let i = 0; i < pages.length; i++) {
        if (cancelRef.current) {
          setPhase("cancelled");
          return;
        }

        const result = await recognizePage(pages[i], i, {
          langs: ["jpn", "eng"],
          onProgress: (p) =>
            setProgress({ ...p, pageIndex: i, totalPages }),
        });

        results.push(result);
        setPageResults([...results]);
      }

      setPhase("done");
    } catch (e) {
      setError(String(e));
      setPhase("error");
    }
  };

  const handleCancel = (): void => {
    cancelRef.current = true;
  };

  const handleSave = async (): Promise<void> => {
    const ocrResult: OcrDocumentResult = {
      pages: pageResults,
      engine: "tesseract.js",
      engineVersion: "5",
      createdAt: new Date().toISOString(),
    };

    try {
      const searchableBytes = await embedTextLayer(originalBytes, ocrResult);
      const savePath = await dialogSave({
        defaultPath: "document-searchable.pdf",
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (savePath) {
        await writeFile(savePath as string, searchableBytes);
        window.alert(`保存しました:\n${savePath}`);
      }
    } catch (e) {
      window.alert(`保存失敗: ${String(e)}`);
    }
  };

  const wordCount = pageResults.reduce((sum, r) => sum + r.words.length, 0);

  return (
    <div style={panelStyle}>
      <span style={{ fontWeight: 600, fontSize: 13 }}>テキスト認識 (OCR)</span>

      {phase === "idle" && (
        <button onClick={handleStart} style={btnStyle("#1e3a5f")}>
          認識開始
        </button>
      )}

      {phase === "running" && (
        <>
          <ProgressBar progress={progress} />
          <button onClick={handleCancel} style={btnStyle("#b91c1c")}>
            キャンセル
          </button>
        </>
      )}

      {phase === "done" && (
        <>
          <span style={{ fontSize: 12, color: "#16a34a" }}>
            ✓ 完了 — {wordCount} 語認識
          </span>
          <button onClick={handleSave} style={btnStyle("#16a34a")}>
            検索可能 PDF として保存
          </button>
          <button onClick={() => setPhase("idle")} style={btnStyle("#555")}>
            再実行
          </button>
        </>
      )}

      {phase === "cancelled" && (
        <>
          <span style={{ fontSize: 12, color: "#92400e" }}>キャンセル済み</span>
          <button onClick={() => setPhase("idle")} style={btnStyle("#555")}>
            再実行
          </button>
        </>
      )}

      {phase === "error" && (
        <>
          <span style={{ fontSize: 12, color: "#b91c1c" }}>
            エラー: {error}
          </span>
          <button onClick={() => setPhase("idle")} style={btnStyle("#555")}>
            再試行
          </button>
        </>
      )}
    </div>
  );
}

function ProgressBar({ progress }: { progress: OcrProgress | null }): React.JSX.Element {
  if (!progress) return <span style={{ fontSize: 12 }}>準備中...</span>;

  const pct = Math.round(progress.progress * 100);
  const label =
    progress.totalPages > 1
      ? `ページ ${progress.pageIndex + 1}/${progress.totalPages} — ${pct}%`
      : `${pct}%`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
      <div style={trackStyle}>
        <div style={{ ...fillStyle, width: `${pct}%` }} />
      </div>
      <span style={{ fontSize: 11, whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 16px",
  background: "#f0f4f8",
  borderBottom: "1px solid #d1d5db",
  flexWrap: "wrap",
};

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: "5px 12px",
    borderRadius: 5,
    border: "none",
    background: bg,
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}

const trackStyle: React.CSSProperties = {
  flex: 1,
  height: 6,
  borderRadius: 3,
  background: "#d1d5db",
  overflow: "hidden",
};

const fillStyle: React.CSSProperties = {
  height: "100%",
  background: "#1e3a5f",
  transition: "width 0.2s ease",
};
