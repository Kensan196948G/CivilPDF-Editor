import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

interface OutlineItem {
  title: string;
  dest: string | Array<unknown> | null;
  url: string | null;
  items: OutlineItem[];
}

interface Props {
  pdfDoc: PDFDocumentProxy | null;
  onNavigate: (pageIndex: number) => void;
}

export function BookmarkPanel({ pdfDoc, onNavigate }: Props): React.JSX.Element {
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pdfDoc) { setOutline([]); return; }
    setLoading(true);
    void pdfDoc
      .getOutline()
      .then((items) => {
        setOutline((items ?? []) as OutlineItem[]);
      })
      .catch(() => setOutline([]))
      .finally(() => setLoading(false));
  }, [pdfDoc]);

  const navigateToDest = async (dest: OutlineItem["dest"]): Promise<void> => {
    if (!pdfDoc || dest === null) return;
    try {
      let explicitDest: Array<unknown> | null;
      if (typeof dest === "string") {
        explicitDest = await pdfDoc.getDestination(dest);
      } else {
        explicitDest = dest;
      }
      if (!explicitDest || explicitDest.length === 0) return;

      const first = explicitDest[0];
      if (typeof first === "number") {
        onNavigate(first);
      } else if (first && typeof first === "object" && "num" in first) {
        const idx = await pdfDoc.getPageIndex(first as { num: number; gen: number });
        onNavigate(idx);
      }
    } catch {
      // silently ignore navigation errors
    }
  };

  return (
    <aside style={panelStyle}>
      <strong style={{ fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        📑 目次
      </strong>
      {loading && (
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>読み込み中...</div>
      )}
      {!loading && outline.length === 0 && (
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
          {pdfDoc ? "ブックマークなし" : "PDF を開いてください"}
        </div>
      )}
      <div style={{ marginTop: 6, overflowY: "auto", flex: 1 }}>
        {outline.map((item, i) => (
          <OutlineNode
            key={i}
            item={item}
            depth={0}
            onNavigate={navigateToDest}
          />
        ))}
      </div>
    </aside>
  );
}

function OutlineNode({
  item,
  depth,
  onNavigate,
}: {
  item: OutlineItem;
  depth: number;
  onNavigate: (dest: OutlineItem["dest"]) => void;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = item.items.length > 0;

  return (
    <div>
      <div
        onClick={() => {
          if (hasChildren) setExpanded((e) => !e);
          void onNavigate(item.dest);
        }}
        style={nodeStyle(depth)}
        title={item.title}
      >
        <span style={{ flex: 0, width: 12, fontSize: 9, color: "#94a3b8" }}>
          {hasChildren ? (expanded ? "▾" : "▸") : " "}
        </span>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.title}
        </span>
      </div>
      {expanded && hasChildren && (
        <div>
          {item.items.map((child, i) => (
            <OutlineNode
              key={i}
              item={child}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  width: 200,
  minWidth: 200,
  display: "flex",
  flexDirection: "column",
  padding: "12px 8px",
  borderRight: "1px solid #e2e8f0",
  background: "#f8fafc",
  overflowY: "hidden",
};

function nodeStyle(depth: number): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 4,
    paddingLeft: 8 + depth * 12,
    paddingTop: 4,
    paddingBottom: 4,
    paddingRight: 4,
    fontSize: 12,
    cursor: "pointer",
    borderRadius: 3,
    color: "#334155",
  };
}
