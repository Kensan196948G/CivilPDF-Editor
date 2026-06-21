import { useState } from "react";
import type { HfConfig, HfAlign } from "../lib/document/header-footer";

interface Props {
  onApply: (config: HfConfig) => void;
  onClose: () => void;
  busy: boolean;
}

export function HeaderFooterDialog({ onApply, onClose, busy }: Props): React.JSX.Element {
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("{n} / {total}");
  const [fontSize, setFontSize] = useState(10);
  const [align, setAlign] = useState<HfAlign>("center");

  const hint = "ヒント: {n} = ページ番号, {total} = 総ページ数";

  const handleApply = (): void => {
    onApply({ headerText: headerText || undefined, footerText: footerText || undefined, fontSize, align });
  };

  return (
    <div style={overlay}>
      <div style={dialog}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>ヘッダー / フッター設定</h3>

        <p style={{ fontSize: 11, color: "#777", margin: "0 0 12px" }}>{hint}</p>

        <div style={row}>
          <label style={label}>ヘッダーテキスト</label>
          <input
            value={headerText}
            onChange={(e) => setHeaderText(e.target.value)}
            placeholder="（空白 = ヘッダーなし）"
            style={input}
          />
        </div>

        <div style={row}>
          <label style={label}>フッターテキスト</label>
          <input
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder="（空白 = フッターなし）"
            style={input}
          />
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>フォントサイズ (pt)</label>
            <input
              type="number"
              value={fontSize}
              min={6}
              max={24}
              onChange={(e) => setFontSize(Number(e.target.value))}
              style={{ ...input, width: 70 }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>配置</label>
            <select value={align} onChange={(e) => setAlign(e.target.value as HfAlign)} style={select}>
              <option value="left">左寄せ</option>
              <option value="center">中央</option>
              <option value="right">右寄せ</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnSecondary}>キャンセル</button>
          <button
            onClick={handleApply}
            disabled={busy || (!headerText && !footerText)}
            style={{ ...btnPrimary, opacity: (!headerText && !footerText) ? 0.5 : 1 }}
          >
            {busy ? "適用中..." : "適用"}
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
  background: "#fff", borderRadius: 8, padding: 24, width: 380, boxShadow: "0 4px 24px rgba(0,0,0,.3)",
};
const row: React.CSSProperties = { marginBottom: 12 };
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#555" };
const input: React.CSSProperties = { width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" };
const select: React.CSSProperties = { width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 13 };
const btnSecondary: React.CSSProperties = { padding: "6px 14px", borderRadius: 6, border: "1px solid #ccc", background: "#f5f5f5", cursor: "pointer", fontSize: 13 };
const btnPrimary: React.CSSProperties = { padding: "6px 16px", borderRadius: 6, border: "none", background: "#1e3a5f", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 };
