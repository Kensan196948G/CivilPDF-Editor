import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import type { CompareResult } from "../lib/document/compare";

interface Props {
  onCompare: (bytesB: Uint8Array) => Promise<CompareResult>;
  onClose: () => void;
  busy: boolean;
}

const KIND_STYLE: Record<string, React.CSSProperties> = {
  added: { background: "#d1fae5", color: "#065f46" },
  removed: { background: "#fee2e2", color: "#991b1b" },
  equal: { color: "#555" },
};

export function ComparePdfDialog({ onCompare, onClose, busy }: Props): React.JSX.Element {
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [running, setRunning] = useState(false);
  const [showEqual, setShowEqual] = useState(false);

  const pickFile = async (): Promise<void> => {
    const selected = await openDialog({ filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (selected && !Array.isArray(selected)) setTargetPath(selected);
  };

  const handleCompare = async (): Promise<void> => {
    if (!targetPath) return;
    setRunning(true);
    try {
      const bytes = await readFile(targetPath);
      const res = await onCompare(bytes);
      setResult(res);
    } finally {
      setRunning(false);
    }
  };

  const displayDiff = result
    ? showEqual ? result.diff : result.diff.filter((d) => d.kind !== "equal")
    : [];

  return (
    <div style={overlay}>
      <div style={dialog}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>PDF 比較（テキスト差分）</h3>
        <p style={{ fontSize: 12, color: "#666", margin: "0 0 12px" }}>
          現在開いているPDFを「基準」とし、比較対象PDFを選択してください。
        </p>

        <div style={{ marginBottom: 12 }}>
          <button onClick={() => void pickFile()} disabled={busy || running} style={btnSecondary}>
            比較対象 PDF を選択...
          </button>
          {targetPath && (
            <span style={{ marginLeft: 8, fontSize: 12, color: "#444" }}>
              {targetPath.split(/[\\/]/).pop()}
            </span>
          )}
        </div>

        {result && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: "#065f46", marginRight: 12 }}>✚ 追加: {result.added}</span>
              <span style={{ color: "#991b1b", marginRight: 12 }}>✖ 削除: {result.removed}</span>
              <span style={{ color: "#555" }}>= 一致: {result.equal}</span>
            </div>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={showEqual} onChange={(e) => setShowEqual(e.target.checked)} />
              変更なし行も表示
            </label>
          </div>
        )}

        {displayDiff.length > 0 && (
          <div style={{ maxHeight: 340, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 4, fontFamily: "monospace", fontSize: 12 }}>
            {displayDiff.map((line, i) => (
              <div
                key={i}
                style={{
                  padding: "2px 8px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  ...KIND_STYLE[line.kind],
                }}
              >
                {line.kind === "added" ? "+ " : line.kind === "removed" ? "- " : "  "}{line.text}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} style={btnSecondary}>閉じる</button>
          <button
            onClick={() => void handleCompare()}
            disabled={busy || running || !targetPath}
            style={{ ...btnPrimary, opacity: !targetPath ? 0.5 : 1 }}
          >
            {running ? "比較中..." : "比較実行"}
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
  background: "#fff", borderRadius: 8, padding: 24, width: 540, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 4px 24px rgba(0,0,0,.3)",
};
const btnSecondary: React.CSSProperties = { padding: "6px 14px", borderRadius: 6, border: "1px solid #ccc", background: "#f5f5f5", cursor: "pointer", fontSize: 13 };
const btnPrimary: React.CSSProperties = { padding: "6px 16px", borderRadius: 6, border: "none", background: "#1e3a5f", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 };
