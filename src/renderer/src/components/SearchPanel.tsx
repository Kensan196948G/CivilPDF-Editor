import { useState, useCallback, useRef } from "react";
import type { PDFPageProxy } from "pdfjs-dist";

interface SearchMatch {
  pageIndex: number;
  context: string;
}

interface Props {
  pages: PDFPageProxy[];
  onNavigate: (pageIndex: number) => void;
}

export function SearchPanel({ pages, onNavigate }: Props): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [current, setCurrent] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(async (q: string): Promise<void> => {
    const term = q.trim().toLowerCase();
    if (!term || pages.length === 0) { setMatches([]); setCurrent(-1); return; }
    setSearching(true);
    const results: SearchMatch[] = [];
    try {
      for (let i = 0; i < pages.length; i++) {
        const content = await pages[i].getTextContent();
        const pageText = (content.items as { str: string }[]).map((it) => it.str).join("");
        const lower = pageText.toLowerCase();
        let idx = lower.indexOf(term);
        while (idx !== -1) {
          const start = Math.max(0, idx - 25);
          const end = Math.min(pageText.length, idx + term.length + 25);
          results.push({ pageIndex: i, context: pageText.slice(start, end) });
          idx = lower.indexOf(term, idx + 1);
        }
      }
    } finally {
      setSearching(false);
    }
    setMatches(results);
    if (results.length > 0) {
      setCurrent(0);
      onNavigate(results[0].pageIndex);
    } else {
      setCurrent(-1);
    }
  }, [pages, onNavigate]);

  const navigate = (delta: 1 | -1): void => {
    if (matches.length === 0) return;
    const next = (current + delta + matches.length) % matches.length;
    setCurrent(next);
    onNavigate(matches[next].pageIndex);
  };

  return (
    <div style={panelStyle}>
      <strong style={{ fontSize: 13 }}>🔍 テキスト検索</strong>
      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void runSearch(query)}
          placeholder="キーワードを入力..."
          style={inputStyle}
        />
        <button onClick={() => void runSearch(query)} disabled={searching} style={actionBtn}>
          {searching ? "検索中" : "検索"}
        </button>
        {matches.length > 0 && (
          <>
            <button onClick={() => navigate(-1)} style={navBtn} title="前の結果">◀</button>
            <button onClick={() => navigate(1)} style={navBtn} title="次の結果">▶</button>
          </>
        )}
      </div>

      {matches.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
          {current + 1} / {matches.length} 件
        </div>
      )}

      <div style={{ maxHeight: 180, overflowY: "auto", marginTop: 4 }}>
        {matches.map((m, i) => (
          <div
            key={i}
            onClick={() => { setCurrent(i); onNavigate(m.pageIndex); }}
            style={resultRow(i === current)}
          >
            <span style={{ color: "#94a3b8", marginRight: 6 }}>p.{m.pageIndex + 1}</span>
            {m.context}
          </div>
        ))}
      </div>

      {!searching && query.trim() && matches.length === 0 && (
        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>一致なし</div>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  padding: "10px 16px",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "4px 8px",
  fontSize: 13,
  border: "1px solid #cbd5e1",
  borderRadius: 4,
};

const actionBtn: React.CSSProperties = {
  padding: "4px 12px",
  fontSize: 12,
  borderRadius: 4,
  border: "1px solid #0284c7",
  background: "#0284c7",
  color: "#fff",
  cursor: "pointer",
};

const navBtn: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 12,
  borderRadius: 4,
  border: "1px solid #cbd5e1",
  background: "#fff",
  cursor: "pointer",
};

function resultRow(active: boolean): React.CSSProperties {
  return {
    padding: "3px 8px",
    cursor: "pointer",
    borderRadius: 3,
    fontSize: 12,
    background: active ? "#dbeafe" : "transparent",
    marginBottom: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}
