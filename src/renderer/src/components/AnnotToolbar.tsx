import type { AnnotKind } from "../lib/annotations/types";

export type AnnotTool = AnnotKind | "erase";

const TOOLS: { id: AnnotTool; label: string; title: string }[] = [
  { id: "textedit",   label: "テキスト編集", title: "テキストをクリックして内容を変更（ホワイトアウト＋新テキスト）" },
  { id: "highlight",  label: "蛍光ペン",     title: "テキストをハイライト（ドラッグ）" },
  { id: "underline",  label: "下線",         title: "下線を引く（ドラッグ）" },
  { id: "strikeout",  label: "取消線",       title: "取消線を引く（ドラッグ）" },
  { id: "note",       label: "付箋",         title: "付箋を貼る（クリック）" },
  { id: "ink",        label: "手書き",       title: "手書き描画（ドラッグ）" },
  { id: "erase",      label: "消去",         title: "注釈をクリックして消去" },
];

const PRESET_COLORS = ["#ffeb3b", "#4caf50", "#2196f3", "#f44336", "#9c27b0", "#ff9800"];

interface Props {
  activeTool: AnnotTool | null;
  activeColor: string;
  onToolChange: (tool: AnnotTool | null) => void;
  onColorChange: (color: string) => void;
}

export function AnnotToolbar({ activeTool, activeColor, onToolChange, onColorChange }: Props): React.JSX.Element {
  return (
    <div style={barStyle}>
      <span style={{ fontWeight: 600, fontSize: 13, marginRight: 4 }}>注釈</span>
      {TOOLS.map((t) => (
        <button
          key={t.id}
          title={t.title}
          onClick={() => onToolChange(activeTool === t.id ? null : t.id)}
          style={btn(activeTool === t.id)}
        >
          {t.label}
        </button>
      ))}
      <span style={{ marginLeft: 8, fontSize: 12, color: "#555" }}>色:</span>
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          title={c}
          onClick={() => onColorChange(c)}
          style={colorChip(c, activeColor === c)}
        />
      ))}
      <input
        type="color"
        value={activeColor}
        onChange={(e) => onColorChange(e.target.value)}
        title="カスタム色"
        style={{ width: 28, height: 28, border: "none", padding: 0, cursor: "pointer", borderRadius: 4 }}
      />
    </div>
  );
}

const barStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 16px",
  background: "#f0f9ff",
  borderBottom: "1px solid #bae6fd",
  flexWrap: "wrap",
};

function btn(active: boolean): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 4,
    border: `1px solid ${active ? "#0284c7" : "#cbd5e1"}`,
    background: active ? "#0284c7" : "#fff",
    color: active ? "#fff" : "#333",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: active ? 600 : 400,
  };
}

function colorChip(color: string, active: boolean): React.CSSProperties {
  return {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: active ? "2px solid #0284c7" : "2px solid #e2e8f0",
    background: color,
    cursor: "pointer",
    padding: 0,
    outline: active ? "2px solid #0284c7" : "none",
    outlineOffset: 2,
  };
}
