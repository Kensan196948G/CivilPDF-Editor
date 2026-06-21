import { useState } from "react";
import type { PDFPageProxy } from "pdfjs-dist";
import {
  open as dialogOpen,
  save as dialogSave,
} from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { PageView } from "./components/PageView";
import { StampToolbar } from "./components/StampToolbar";
import { loadPdf } from "./lib/pdf";
import { embedStampsIntoPdf } from "./lib/embed";
import { formatBytes } from "./lib/format";
import type { Stamp } from "./lib/types";

const DEFAULT_STAMP_WIDTH = 0.15; // fraction of page width

interface ActiveTemplate {
  src: string;
  ratio: number;
}

export function App(): React.JSX.Element {
  const [fileName, setFileName] = useState<string | null>(null);
  const [originalBytes, setOriginalBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [template, setTemplate] = useState<ActiveTemplate | null>(null);
  const [busy, setBusy] = useState(false);

  const handleOpen = async (): Promise<void> => {
    setBusy(true);
    try {
      const path = await dialogOpen({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!path) return;
      const bytes = await readFile(path as string);
      const name = (path as string).split(/[/\\]/).pop() ?? "document.pdf";
      const doc = await loadPdf(bytes);
      const loaded: PDFPageProxy[] = [];
      for (let n = 1; n <= doc.numPages; n += 1)
        loaded.push(await doc.getPage(n));
      setFileName(name);
      setOriginalBytes(bytes);
      setPages(loaded);
      setStamps([]);
      setTemplate(null);
    } finally {
      setBusy(false);
    }
  };

  const handlePlace = (pageIndex: number, x: number, y: number): void => {
    if (!template) return;
    setStamps((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        page: pageIndex,
        x,
        y,
        w: DEFAULT_STAMP_WIDTH,
        ratio: template.ratio,
        src: template.src,
      },
    ]);
  };

  const handleUpdate = (
    id: string,
    partial: Partial<Pick<Stamp, "x" | "y" | "w">>,
  ): void => {
    setStamps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...partial } : s)),
    );
  };

  const handleRemove = (id: string): void => {
    setStamps((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSave = async (): Promise<void> => {
    if (!originalBytes) return;
    setBusy(true);
    try {
      const out = await embedStampsIntoPdf(originalBytes, stamps);
      const base = (fileName ?? "document.pdf").replace(/\.pdf$/i, "");
      const savePath = await dialogSave({
        defaultPath: `${base}-stamped.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (savePath) {
        await writeFile(savePath as string, out);
        window.alert(`保存しました:\n${savePath}`);
      }
    } catch (e) {
      window.alert(`保存に失敗しました: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        color: "#1a1a1a",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          background: "#1e3a5f",
          color: "#fff",
        }}
      >
        <strong style={{ fontSize: 15 }}>CivilPDF Editor</strong>
        <span style={{ fontSize: 12, opacity: 0.8 }}>電子印鑑</span>
        <button onClick={handleOpen} disabled={busy} style={headerBtn}>
          {busy ? "処理中..." : "PDF を開く"}
        </button>
        {originalBytes && (
          <button
            onClick={handleSave}
            disabled={busy || stamps.length === 0}
            style={{ ...headerBtn, background: "#16a34a", color: "#fff" }}
          >
            押印して保存（{stamps.length}）
          </button>
        )}
      </header>

      {originalBytes && (
        <StampToolbar
          template={template}
          onSetTemplate={setTemplate}
          onClearTemplate={() => setTemplate(null)}
        />
      )}

      <main
        style={{
          flex: 1,
          overflow: "auto",
          padding: 16,
          background: "#f4f5f7",
        }}
      >
        {pages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#888", marginTop: 80 }}>
            <p style={{ fontSize: 15 }}>PDF を開いて電子印鑑を押印します</p>
            <p style={{ fontSize: 12 }}>
              印影を作成 → ページをクリックで配置 → ドラッグ移動・リサイズ →
              押印して保存
            </p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12, fontSize: 13, color: "#444" }}>
              📄 {fileName}（{formatBytes(originalBytes?.byteLength ?? 0)}） /
              全 {pages.length} ページ
            </div>
            {pages.map((p, i) => (
              <PageView
                key={i}
                page={p}
                pageIndex={i}
                stamps={stamps.filter((s) => s.page === i)}
                placing={template !== null}
                onPlace={handlePlace}
                onUpdate={handleUpdate}
                onRemove={handleRemove}
              />
            ))}
          </>
        )}
      </main>
    </div>
  );
}

const headerBtn: React.CSSProperties = {
  marginLeft: "auto",
  padding: "6px 14px",
  borderRadius: 6,
  border: "none",
  background: "#fff",
  color: "#1e3a5f",
  fontWeight: 600,
  cursor: "pointer",
};
