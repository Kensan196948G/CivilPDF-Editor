import { useState } from "react";
import type { PdfMetadata } from "../lib/document/metadata";

export type { PdfMetadata };

interface Props {
  initial?: Partial<PdfMetadata>;
  onSave: (meta: PdfMetadata) => void;
  onClose: () => void;
  busy?: boolean;
}

export function MetadataDialog({ initial, onSave, onClose, busy }: Props): React.JSX.Element {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [keywords, setKeywords] = useState(initial?.keywords ?? "");
  const [creator, setCreator] = useState(initial?.creator ?? "CivilPDF Editor");

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15 }}>📄 文書プロパティ</h3>

        {([
          ["タイトル", title, setTitle],
          ["著者", author, setAuthor],
          ["件名", subject, setSubject],
          ["キーワード", keywords, setKeywords],
          ["作成アプリ", creator, setCreator],
        ] as [string, string, (v: string) => void][]).map(([label, value, setter]) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{label}</label>
            <input
              value={value}
              onChange={(e) => setter(e.target.value)}
              style={inputStyle}
              placeholder={`${label}を入力...`}
            />
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={cancelBtn} disabled={busy}>キャンセル</button>
          <button
            onClick={() => onSave({ title, author, subject, keywords, creator })}
            style={applyBtn}
            disabled={busy}
          >
            {busy ? "処理中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
};

const dialogStyle: React.CSSProperties = {
  background: "#fff", borderRadius: 8, padding: 24, width: 380,
  boxShadow: "0 8px 32px rgba(0,0,0,.2)",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, color: "#475569", marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "6px 8px", fontSize: 13,
  border: "1px solid #cbd5e1", borderRadius: 4, boxSizing: "border-box",
};

const cancelBtn: React.CSSProperties = {
  padding: "6px 16px", borderRadius: 6, border: "1px solid #cbd5e1",
  background: "#fff", cursor: "pointer", fontSize: 13,
};

const applyBtn: React.CSSProperties = {
  padding: "6px 16px", borderRadius: 6, border: "none",
  background: "#1e3a5f", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
};
