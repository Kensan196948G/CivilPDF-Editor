import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import type { ImageMime, PageSizePreset } from "../lib/document/image-to-pdf";

interface Props {
  onConvert: (images: { bytes: Uint8Array; mime: ImageMime }[], pageSize: PageSizePreset) => void;
  onClose: () => void;
  busy: boolean;
}

export function ImageToPdfDialog({ onConvert, onClose, busy }: Props): React.JSX.Element {
  const [files, setFiles] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<PageSizePreset>("A4");

  const pickImages = async (): Promise<void> => {
    const selected = await openDialog({
      multiple: true,
      filters: [{ name: "画像ファイル", extensions: ["png", "jpg", "jpeg"] }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    setFiles((prev) => [...prev, ...paths]);
  };

  const handleConvert = async (): Promise<void> => {
    if (files.length === 0) return;
    const images = await Promise.all(
      files.map(async (path) => {
        const bytes = await readFile(path);
        const mime: ImageMime = path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
        return { bytes, mime };
      }),
    );
    onConvert(images, pageSize);
  };

  return (
    <div style={overlay}>
      <div style={dialog}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>画像 → PDF 変換</h3>

        <div style={{ marginBottom: 12 }}>
          <label style={label}>用紙サイズ</label>
          <select value={pageSize} onChange={(e) => setPageSize(e.target.value as PageSizePreset)} style={select}>
            <option value="A4">A4（縦）/ 横向き画像は自動ランドスケープ</option>
            <option value="A3">A3</option>
            <option value="fit">画像サイズに合わせる</option>
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={label}>画像ファイル（PNG / JPEG）</label>
          <button onClick={() => void pickImages()} disabled={busy} style={btnSecondary}>
            ファイルを追加...
          </button>
          {files.length > 0 && (
            <ul style={{ margin: "8px 0 0", padding: "0 0 0 18px", fontSize: 12, color: "#444" }}>
              {files.map((f, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {f.split(/[\\/]/).pop()}
                  <button
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    style={{ fontSize: 10, padding: "1px 6px", cursor: "pointer" }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnSecondary}>キャンセル</button>
          <button
            onClick={() => void handleConvert()}
            disabled={busy || files.length === 0}
            style={{ ...btnPrimary, opacity: files.length === 0 ? 0.5 : 1 }}
          >
            {busy ? "変換中..." : "PDFに変換"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
};
const dialog: React.CSSProperties = {
  background: "#fff", borderRadius: 8, padding: 24, width: 420, maxHeight: "80vh", overflowY: "auto", boxShadow: "0 4px 24px rgba(0,0,0,.3)",
};
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#555" };
const select: React.CSSProperties = { width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 13 };
const btnSecondary: React.CSSProperties = { padding: "6px 14px", borderRadius: 6, border: "1px solid #ccc", background: "#f5f5f5", cursor: "pointer", fontSize: 13 };
const btnPrimary: React.CSSProperties = { padding: "6px 16px", borderRadius: 6, border: "none", background: "#1e3a5f", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 };
