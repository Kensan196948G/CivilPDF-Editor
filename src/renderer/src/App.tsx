import { useState, useMemo } from "react";
import { PageView } from "./components/PageView";
import { StampToolbar } from "./components/StampToolbar";
import { ZoomControls } from "./components/ZoomControls";
import { OcrPanel } from "./components/OcrPanel";
import { ReviewPanel } from "./components/ReviewPanel";
import { PagePanel } from "./components/PagePanel";
import { useDocument } from "./lib/document/useDocument";
import { useAppMenu, type MenuHandlers } from "./hooks/useAppMenu";
import { formatBytes } from "./lib/format";
import type { Stamp } from "./lib/types";

const DEFAULT_STAMP_WIDTH = 0.15; // fraction of page width
const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4.0;

interface ActiveTemplate {
  src: string;
  ratio: number;
}

export function App(): React.JSX.Element {
  const doc = useDocument();
  const { state } = doc;
  const [template, setTemplate] = useState<ActiveTemplate | null>(null);
  const [author, setAuthor] = useState("");
  const [selectedPage, setSelectedPage] = useState<number | null>(null);

  const clampScale = (s: number): number =>
    Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(s * 100) / 100));

  const handlePlace = (pageIndex: number, x: number, y: number): void => {
    if (!template) return;
    const stamp: Stamp = {
      id: crypto.randomUUID(),
      page: pageIndex,
      x,
      y,
      w: DEFAULT_STAMP_WIDTH,
      ratio: template.ratio,
      src: template.src,
      author,
      createdAt: new Date().toISOString(),
      status: "pending",
      history: [],
    };
    doc.addStamp(stamp);
  };

  const handleMovePage = (direction: -1 | 1): void => {
    if (selectedPage === null) return;
    const target = selectedPage + direction;
    if (target < 0 || target >= state.pages.length) return;
    const order = state.pages.map((_, i) => i);
    [order[selectedPage], order[target]] = [order[target], order[selectedPage]];
    void doc.reorder(order);
    setSelectedPage(target);
  };

  // Menu handlers — rebuilt each render so the menu always calls current state.
  const menuHandlers: MenuHandlers = {
    "file.open": doc.open,
    "file.save": doc.save,
    "file.saveAs": doc.saveAs,
    "file.finalize": () => doc.finalize(),
    "file.exportDocx": doc.exportDocx,
    "file.exportImages": doc.exportImages,
    "file.print": doc.print,
    "edit.rotateCw": () => {
      if (selectedPage !== null) void doc.rotate([selectedPage], 90);
    },
    "edit.rotateCcw": () => {
      if (selectedPage !== null) void doc.rotate([selectedPage], -90);
    },
    "edit.deletePage": () => {
      if (selectedPage !== null) void doc.removePages([selectedPage]);
    },
    "edit.insertFrom": () => doc.insertFromFile(selectedPage ?? state.pages.length),
    "view.zoomIn": () => doc.setScale(clampScale(state.scale + ZOOM_STEP)),
    "view.zoomOut": () => doc.setScale(clampScale(state.scale - ZOOM_STEP)),
    "view.zoomReset": () => doc.setScale(1.0),
  };
  useAppMenu(menuHandlers, doc.canSave);

  const hasDoc = state.docBytes !== null;
  const stampsByPage = useMemo(() => {
    const map = new Map<number, Stamp[]>();
    for (const s of state.stamps) {
      const arr = map.get(s.page) ?? [];
      arr.push(s);
      map.set(s.page, arr);
    }
    return map;
  }, [state.stamps]);

  return (
    <div style={rootStyle}>
      <header style={headerStyle}>
        <strong style={{ fontSize: 15 }}>CivilPDF Editor</strong>
        <span style={{ fontSize: 12, opacity: 0.8 }}>
          編集・印鑑・OCR・変換
        </span>
        <button onClick={() => void doc.open()} disabled={state.busy} style={{ ...headerBtn, marginLeft: "auto" }}>
          {state.busy ? "処理中..." : "PDF を開く"}
        </button>
        {hasDoc && (
          <>
            <button
              onClick={() => void doc.save()}
              disabled={state.busy}
              style={{ ...headerBtn, background: "#16a34a", color: "#fff" }}
            >
              保存{state.dirty ? " *" : ""}
            </button>
            <button
              onClick={() => void doc.finalize()}
              disabled={state.busy}
              style={{ ...headerBtn, background: "#1e3a5f", color: "#fff" }}
            >
              確定保存
            </button>
          </>
        )}
      </header>

      {hasDoc && (
        <StampToolbar
          template={template}
          author={author}
          onSetTemplate={setTemplate}
          onClearTemplate={() => setTemplate(null)}
          onAuthorChange={setAuthor}
        />
      )}

      {hasDoc && (
        <PagePanel
          pageCount={state.pages.length}
          selectedPage={selectedPage}
          busy={state.busy}
          onSelectPage={setSelectedPage}
          onRotate={(delta) => selectedPage !== null && void doc.rotate([selectedPage], delta)}
          onDelete={() => selectedPage !== null && void doc.removePages([selectedPage])}
          onMove={handleMovePage}
          onInsert={() => void doc.insertFromFile(selectedPage ?? state.pages.length)}
        />
      )}

      {hasDoc && state.pages.length > 0 && (
        <OcrPanel
          pages={state.pages}
          originalBytes={state.docBytes!}
          onResult={doc.applyOcr}
        />
      )}
      {state.pages.length > 0 && (
        <ZoomControls scale={state.scale} onScale={doc.setScale} />
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <main style={mainStyle}>
          {state.pages.length === 0 ? (
            <div style={{ textAlign: "center", color: "#888", marginTop: 80 }}>
              <p style={{ fontSize: 15 }}>PDF を開いて編集・押印・変換します</p>
              <p style={{ fontSize: 12 }}>
                ファイルメニュー（または「PDF を開く」）から開始 →
                ページ編集・注釈・押印 → 保存／印刷／Word 書き出し
              </p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12, fontSize: 13, color: "#444" }}>
                📄 {state.fileName}（{formatBytes(state.docBytes?.byteLength ?? 0)}） /
                全 {state.pages.length} ページ
              </div>
              {state.pages.map((p, i) => (
                <div
                  key={`${state.revision}-${i}`}
                  style={{
                    outline: selectedPage === i ? "2px solid #1e3a5f" : "none",
                    outlineOffset: 2,
                  }}
                >
                  <PageView
                    page={p}
                    pageIndex={i}
                    stamps={stampsByPage.get(i) ?? []}
                    placing={template !== null}
                    scale={state.scale}
                    onPlace={handlePlace}
                    onUpdate={doc.updateStamp}
                    onRemove={doc.removeStamp}
                  />
                </div>
              ))}
            </>
          )}
        </main>

        {hasDoc && (
          <ReviewPanel
            stamps={state.stamps}
            selectedId={state.selectedId}
            author={author}
            onSelect={doc.select}
            onApprove={doc.approve}
            onReject={doc.reject}
            onRemove={doc.removeStamp}
          />
        )}
      </div>
    </div>
  );
}

const rootStyle: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  color: "#1a1a1a",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 16px",
  background: "#1e3a5f",
  color: "#fff",
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: 16,
  background: "#f4f5f7",
};

const headerBtn: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 6,
  border: "none",
  background: "#fff",
  color: "#1e3a5f",
  fontWeight: 600,
  cursor: "pointer",
};
