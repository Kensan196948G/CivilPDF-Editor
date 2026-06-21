const MIN_SCALE = 0.5;
const MAX_SCALE = 4.0;
const STEP = 0.25;
export const DEFAULT_SCALE = 1.2;

interface ZoomControlsProps {
  scale: number;
  onScale: (scale: number) => void;
}

export function ZoomControls({ scale, onScale }: ZoomControlsProps): React.JSX.Element {
  const pct = Math.round((scale / DEFAULT_SCALE) * 100);

  return (
    <div style={barStyle}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>🔍 表示倍率</span>
      <button
        onClick={() => onScale(Math.max(MIN_SCALE, round(scale - STEP)))}
        disabled={scale <= MIN_SCALE}
        style={btnStyle}
        title="縮小"
      >
        −
      </button>
      <span style={{ fontSize: 12, minWidth: 44, textAlign: "center" }}>{pct}%</span>
      <button
        onClick={() => onScale(Math.min(MAX_SCALE, round(scale + STEP)))}
        disabled={scale >= MAX_SCALE}
        style={btnStyle}
        title="拡大"
      >
        ＋
      </button>
      <button onClick={() => onScale(DEFAULT_SCALE)} style={{ ...btnStyle, fontSize: 11, padding: "3px 8px" }}>
        リセット
      </button>
    </div>
  );
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

const barStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 16px",
  background: "#f9fafb",
  borderBottom: "1px solid #e5e7eb",
};

const btnStyle: React.CSSProperties = {
  padding: "3px 10px",
  borderRadius: 4,
  border: "1px solid #d1d5db",
  background: "#fff",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
};
