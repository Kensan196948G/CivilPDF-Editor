import { useState, useMemo, useEffect } from "react";
import { PageView } from "./components/PageView";
import { StampToolbar } from "./components/StampToolbar";
import { ZoomControls } from "./components/ZoomControls";
import { OcrPanel } from "./components/OcrPanel";
import { ReviewPanel } from "./components/ReviewPanel";
import { DxSyncButton } from "./components/DxSyncButton";
import { DxSettingsModal } from "./components/DxSettingsModal";
import { readDxDocId } from "./lib/dx/docid";
import { PagePanel } from "./components/PagePanel";
import { AnnotToolbar } from "./components/AnnotToolbar";
import type { AnnotTool } from "./components/AnnotToolbar";
import { SearchPanel } from "./components/SearchPanel";
import { BookmarkPanel } from "./components/BookmarkPanel";
import { WatermarkDialog } from "./components/WatermarkDialog";
import type { WatermarkConfig } from "./components/WatermarkDialog";
import { MetadataDialog } from "./components/MetadataDialog";
import { PasswordDialog } from "./components/PasswordDialog";
import { ImageToPdfDialog } from "./components/ImageToPdfDialog";
import { HeaderFooterDialog } from "./components/HeaderFooterDialog";
import { ComparePdfDialog } from "./components/ComparePdfDialog";
import { FormPanel } from "./components/FormPanel";
import type { FormField } from "./lib/document/form-reader";
import type { ImageEntry, PageSizePreset } from "./lib/document/image-to-pdf";
import type { HfConfig } from "./lib/document/header-footer";
import { useDocument } from "./lib/document/useDocument";
import { useAppMenu, type MenuHandlers } from "./hooks/useAppMenu";
import { formatBytes } from "./lib/format";
import type { Stamp } from "./lib/types";
import type { Annotation } from "./lib/annotations/types";
import type { EncryptOptions } from "./lib/document/password";

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
  const [activeTool, setActiveTool] = useState<AnnotTool | null>(null);
  const [activeColor, setActiveColor] = useState("#ffeb3b");
  const [showSearch, setShowSearch] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showWatermark, setShowWatermark] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showImageToPdf, setShowImageToPdf] = useState(false);
  const [showHeaderFooter, setShowHeaderFooter] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [formFields, setFormFields] = useState<FormField[] | null>(null);
  const [dxDocId, setDxDocId] = useState<string | null>(null);
  const [showDxSettings, setShowDxSettings] = useState(false);

  // Read the DX document id embedded in the opened PDF's Info dict so the
  // DxSyncButton can target the right document when syncing the review.
  useEffect(() => {
    let cancelled = false;
    if (state.docBytes) {
      void readDxDocId(state.docBytes).then((id) => {
        if (!cancelled) setDxDocId(id);
      });
    } else {
      setDxDocId(null);
    }
    return () => {
      cancelled = true;
    };
  }, [state.docBytes]);

  const scrollToPage = (pageIndex: number): void => {
    document
      .getElementById(`page-${pageIndex}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
    "edit.insertFrom": () =>
      doc.insertFromFile(selectedPage ?? state.pages.length),
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

  const annotsByPage = useMemo(() => {
    const map = new Map<number, Annotation[]>();
    for (const a of state.annotations) {
      const arr = map.get(a.page) ?? [];
      arr.push(a);
      map.set(a.page, arr);
    }
    return map;
  }, [state.annotations]);

  return (
    <div style={rootStyle}>
      <header style={headerStyle}>
        <strong style={{ fontSize: 15 }}>CivilPDF Editor</strong>
        <span style={{ fontSize: 12, opacity: 0.8 }}>
          編集・印鑑・OCR・変換
        </span>
        <button
          onClick={() => void doc.open()}
          disabled={state.busy}
          style={{ ...headerBtn, marginLeft: "auto" }}
        >
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
            <DxSyncButton
              docId={dxDocId}
              stamps={state.stamps}
              annotations={state.annotations}
              onOpenSettings={() => setShowDxSettings(true)}
            />
            <span
              style={{
                width: 1,
                background: "rgba(255,255,255,0.3)",
                alignSelf: "stretch",
                margin: "0 4px",
              }}
            />
            <button
              onClick={() => setShowSearch((v) => !v)}
              style={{
                ...headerBtn,
                background: showSearch ? "#fff" : "rgba(255,255,255,0.15)",
                color: showSearch ? "#1e3a5f" : "#fff",
              }}
              title="テキスト検索"
            >
              🔍
            </button>
            <button
              onClick={() => setShowBookmarks((v) => !v)}
              style={{
                ...headerBtn,
                background: showBookmarks ? "#fff" : "rgba(255,255,255,0.15)",
                color: showBookmarks ? "#1e3a5f" : "#fff",
              }}
              title="目次・ブックマーク"
            >
              📑
            </button>
            <button
              onClick={() => setShowWatermark(true)}
              disabled={state.busy}
              style={{
                ...headerBtn,
                background: "rgba(255,255,255,0.15)",
                color: "#fff",
              }}
              title="透かし追加"
            >
              🖊
            </button>
            <button
              onClick={() => setShowMetadata(true)}
              disabled={state.busy}
              style={{
                ...headerBtn,
                background: "rgba(255,255,255,0.15)",
                color: "#fff",
              }}
              title="文書プロパティ"
            >
              📋
            </button>
            <button
              onClick={() => setShowPassword(true)}
              disabled={state.busy}
              style={{
                ...headerBtn,
                background: "rgba(255,255,255,0.15)",
                color: "#fff",
              }}
              title="パスワード保護"
            >
              🔐
            </button>
            <span
              style={{
                width: 1,
                background: "rgba(255,255,255,0.3)",
                alignSelf: "stretch",
                margin: "0 4px",
              }}
            />
            <button
              onClick={() => setShowHeaderFooter(true)}
              disabled={state.busy}
              style={{
                ...headerBtn,
                background: "rgba(255,255,255,0.15)",
                color: "#fff",
              }}
              title="ヘッダー/フッター追加"
            >
              ⊤⊥
            </button>
            <button
              onClick={() => setShowCompare(true)}
              disabled={state.busy}
              style={{
                ...headerBtn,
                background: "rgba(255,255,255,0.15)",
                color: "#fff",
              }}
              title="PDF比較"
            >
              ⇆
            </button>
            <button
              onClick={() => {
                void doc
                  .getFormFields()
                  .then((fields) => setFormFields(fields));
              }}
              disabled={state.busy}
              style={{
                ...headerBtn,
                background:
                  formFields !== null ? "#fff" : "rgba(255,255,255,0.15)",
                color: formFields !== null ? "#1e3a5f" : "#fff",
              }}
              title="フォームフィールド確認"
            >
              📝
            </button>
          </>
        )}
        <button
          onClick={() => setShowImageToPdf(true)}
          style={{
            ...headerBtn,
            background: "rgba(255,255,255,0.15)",
            color: "#fff",
            marginLeft: hasDoc ? 0 : "auto",
          }}
          title="画像→PDF変換"
        >
          🖼
        </button>
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
        <AnnotToolbar
          activeTool={activeTool}
          activeColor={activeColor}
          onToolChange={setActiveTool}
          onColorChange={setActiveColor}
        />
      )}

      {hasDoc && (
        <PagePanel
          pageCount={state.pages.length}
          selectedPage={selectedPage}
          busy={state.busy}
          onSelectPage={setSelectedPage}
          onRotate={(delta) =>
            selectedPage !== null && void doc.rotate([selectedPage], delta)
          }
          onDelete={() =>
            selectedPage !== null && void doc.removePages([selectedPage])
          }
          onMove={handleMovePage}
          onInsert={() =>
            void doc.insertFromFile(selectedPage ?? state.pages.length)
          }
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

      {hasDoc && showSearch && state.pages.length > 0 && (
        <SearchPanel pages={state.pages} onNavigate={scrollToPage} />
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {hasDoc && showBookmarks && (
          <BookmarkPanel pdfDoc={doc.pdfDocProxy} onNavigate={scrollToPage} />
        )}
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
                📄 {state.fileName}（
                {formatBytes(state.docBytes?.byteLength ?? 0)}） / 全{" "}
                {state.pages.length} ページ
              </div>
              {state.pages.map((p, i) => (
                <div
                  key={`${state.revision}-${i}`}
                  id={`page-${i}`}
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
                    annotations={annotsByPage.get(i) ?? []}
                    activeTool={activeTool}
                    activeColor={activeColor}
                    onPlace={handlePlace}
                    onUpdate={doc.updateStamp}
                    onRemove={doc.removeStamp}
                    onAddAnnotation={doc.addAnnotation}
                    onRemoveAnnotation={doc.removeAnnotation}
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

        {formFields !== null && (
          <FormPanel fields={formFields} onClose={() => setFormFields(null)} />
        )}
      </div>

      {showWatermark && (
        <WatermarkDialog
          onApply={(cfg: WatermarkConfig) => {
            setShowWatermark(false);
            void doc.applyWatermark(cfg);
          }}
          onClose={() => setShowWatermark(false)}
          busy={state.busy}
        />
      )}

      {showMetadata && (
        <MetadataDialog
          onSave={(meta) => {
            setShowMetadata(false);
            void doc.applyMetadata(meta);
          }}
          onClose={() => setShowMetadata(false)}
          busy={state.busy}
        />
      )}

      {showPassword && (
        <PasswordDialog
          onSave={(opts: EncryptOptions) => {
            setShowPassword(false);
            void doc.saveAsEncrypted(opts);
          }}
          onClose={() => setShowPassword(false)}
          busy={state.busy}
        />
      )}

      {showImageToPdf && (
        <ImageToPdfDialog
          onConvert={(images: ImageEntry[], pageSize: PageSizePreset) => {
            setShowImageToPdf(false);
            void doc.convertImagesToPdf(images, pageSize);
          }}
          onClose={() => setShowImageToPdf(false)}
          busy={state.busy}
        />
      )}

      {showHeaderFooter && (
        <HeaderFooterDialog
          onApply={(config: HfConfig) => {
            setShowHeaderFooter(false);
            void doc.applyHf(config);
          }}
          onClose={() => setShowHeaderFooter(false)}
          busy={state.busy}
        />
      )}

      {showCompare && (
        <ComparePdfDialog
          onCompare={doc.compareWithPdf}
          onClose={() => setShowCompare(false)}
          busy={state.busy}
        />
      )}
      {showDxSettings && (
        <DxSettingsModal onClose={() => setShowDxSettings(false)} />
      )}
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
