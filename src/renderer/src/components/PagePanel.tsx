interface Props {
  pageCount: number;
  selectedPage: number | null;
  busy: boolean;
  onSelectPage: (index: number | null) => void;
  onRotate: (delta: number) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onInsert: () => void;
}

/**
 * Compact page-operation strip. Page thumbnails are intentionally lightweight
 * (numbered chips) to avoid rendering every large-format page; structural edits
 * route through the document model's rebuild path.
 */
export function PagePanel({
  pageCount,
  selectedPage,
  busy,
  onSelectPage,
  onRotate,
  onDelete,
  onMove,
  onInsert,
}: Props): React.JSX.Element {
  const hasSelection = selectedPage !== null;
  return (
    <div style={barStyle}>
      <span style={{ fontWeight: 600, fontSize: 13 }}>ページ編集</span>
      <div style={{ display: "flex", gap: 4, overflowX: "auto", maxWidth: 360 }}>
        {Array.from({ length: pageCount }, (_, i) => (
          <button
            key={i}
            onClick={() => onSelectPage(selectedPage === i ? null : i)}
            style={chip(selectedPage === i)}
            title={`ページ ${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 4, marginLeft: "auto", flexWrap: "wrap" }}>
        <button onClick={() => onRotate(-90)} disabled={!hasSelection || busy} style={opBtn}>
          ⟲ 左回転
        </button>
        <button onClick={() => onRotate(90)} disabled={!hasSelection || busy} style={opBtn}>
          ⟳ 右回転
        </button>
        <button onClick={() => onMove(-1)} disabled={!hasSelection || busy} style={opBtn}>
          ◀ 前へ
        </button>
        <button onClick={() => onMove(1)} disabled={!hasSelection || busy} style={opBtn}>
          次へ ▶
        </button>
        <button onClick={onDelete} disabled={!hasSelection || busy || pageCount <= 1} style={{ ...opBtn, color: "#dc2626" }}>
          削除
        </button>
        <button onClick={onInsert} disabled={busy} style={opBtn}>
          別PDF挿入
        </button>
      </div>
    </div>
  );
}

const barStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 16px",
  background: "#eef2f7",
  borderBottom: "1px solid #d1d5db",
  flexWrap: "wrap",
};

function chip(active: boolean): React.CSSProperties {
  return {
    minWidth: 28,
    padding: "4px 6px",
    borderRadius: 4,
    border: `1px solid ${active ? "#1e3a5f" : "#cbd5e1"}`,
    background: active ? "#1e3a5f" : "#fff",
    color: active ? "#fff" : "#333",
    fontSize: 12,
    cursor: "pointer",
  };
}

const opBtn: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 4,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontSize: 12,
  cursor: "pointer",
};
