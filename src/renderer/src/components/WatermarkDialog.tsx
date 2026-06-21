import { useState } from "react";

export interface WatermarkConfig {
  text: string;
  opacity: number;
  fontSize: number;
  angle: number;
  color: string;
}

const PRESETS = [
  { label: "草案", text: "草案" },
  { label: "機密", text: "機密" },
  { label: "承認待ち", text: "承認待ち" },
  { label: "DRAFT", text: "DRAFT" },
  { label: "CONFIDENTIAL", text: "CONFIDENTIAL" },
  { label: "SAMPLE", text: "SAMPLE" },
];

interface Props {
  onApply: (config: WatermarkConfig) => void;
  onClose: () => void;
  busy?: boolean;
}

export function WatermarkDialog({ onApply, onClose, busy }: Props): React.JSX.Element {
  const [text, setText] = useState("草案");
  const [opacity, setOpacity] = useState(0.25);
  const [fontSize, setFontSize] = useState(60);
  const [angle, setAngle] = useState(45);
  const [color, setColor] = useState("#888888");

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15 }}>🖊️ ウォーターマーク追加</h3>

        <label style={labelStyle}>テキスト</label>
        <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
          {PRESETS.map((p) => (
            <button key={p.text} onClick={() => setText(p.text)} style={presetBtn(text === p.text)}>
              {p.label}
            </button>
          ))}
        </div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="テキストを入力..."
          style={inputStyle}
        />

        <label style={labelStyle}>透明度: {Math.round(opacity * 100)}%</label>
        <input
          type="range" min="0.05" max="0.8" step="0.05"
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          style={{ width: "100%", marginBottom: 10 }}
        />

        <label style={labelStyle}>フォントサイズ: {fontSize}pt</label>
        <input
          type="range" min="20" max="120" step="4"
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          style={{ width: "100%", marginBottom: 10 }}
        />

        <label style={labelStyle}>角度: {angle}°</label>
        <input
          type="range" min="-90" max="90" step="5"
          value={angle}
          onChange={(e) => setAngle(Number(e.target.value))}
          style={{ width: "100%", marginBottom: 10 }}
        />

        <label style={labelStyle}>色</label>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={{ width: 50, height: 30, marginBottom: 16, cursor: "pointer", border: "none" }}
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={cancelBtn} disabled={busy}>キャンセル</button>
          <button
            onClick={() => onApply({ text, opacity, fontSize, angle, color })}
            style={applyBtn}
            disabled={busy || !text.trim()}
          >
            {busy ? "処理中..." : "適用"}
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
  border: "1px solid #cbd5e1", borderRadius: 4, marginBottom: 12, boxSizing: "border-box",
};

const cancelBtn: React.CSSProperties = {
  padding: "6px 16px", borderRadius: 6, border: "1px solid #cbd5e1",
  background: "#fff", cursor: "pointer", fontSize: 13,
};

const applyBtn: React.CSSProperties = {
  padding: "6px 16px", borderRadius: 6, border: "none",
  background: "#1e3a5f", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
};

function presetBtn(active: boolean): React.CSSProperties {
  return {
    padding: "3px 8px", borderRadius: 4, border: `1px solid ${active ? "#0284c7" : "#cbd5e1"}`,
    background: active ? "#dbeafe" : "#fff", cursor: "pointer", fontSize: 11,
    color: active ? "#0284c7" : "#475569",
  };
}
