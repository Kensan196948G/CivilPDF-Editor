import { useEffect, useRef, useState } from "react";
import type { PDFPageProxy } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { Annotation, FracRect, TextEditAnnot } from "../lib/annotations/types";

interface TextHit {
  text: string;
  rect: FracRect;
  fontSize: number; // PDF points
}

interface Props {
  page: PDFPageProxy;
  pageIndex: number;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
  active: boolean;
  onAdd: (annot: Annotation) => void;
}

/**
 * Invisible hit-zone layer for text editing.
 *
 * When the text-edit tool is active it calls pdfjs getTextContent(), converts
 * each text item into a fractional bounding box, and renders clickable
 * transparent divs.  Clicking a div opens an inline editor popup; confirming
 * emits a TextEditAnnot (whiteout + new text) via onAdd.
 */
export function TextEditLayer({
  page,
  pageIndex,
  scale,
  viewportWidth,
  viewportHeight,
  active,
  onAdd,
}: Props): React.JSX.Element {
  const [hits, setHits] = useState<TextHit[]>([]);
  const [editing, setEditing] = useState<{ hit: TextHit; value: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Build text hit zones whenever the tool becomes active or scale changes.
  useEffect(() => {
    if (!active) {
      setHits([]);
      return;
    }
    let cancelled = false;

    page
      .getTextContent()
      .then((content) => {
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const result: TextHit[] = [];

        for (const raw of content.items) {
          const item = raw as TextItem;
          if (!item.str || !item.str.trim()) continue;

          // transform: [a, b, c, d, e, f] — e=basePdfX, f=basePdfY (baseline)
          const [vpX, vpBaselineY] = viewport.convertToViewportPoint(
            item.transform[4],
            item.transform[5],
          );

          // Font height ≈ magnitude of (c, d) column (y-scale of the matrix).
          const fontSize = Math.sqrt(
            item.transform[2] * item.transform[2] +
              item.transform[3] * item.transform[3],
          );
          const vpHeight = Math.max(6, fontSize);
          const vpWidth = Math.max(4, item.width * scale);

          // vpBaselineY is distance from top; text sits ABOVE the baseline.
          const vpTop = vpBaselineY - vpHeight;
          const vpLeft = vpX;

          // Skip items outside the visible page area.
          if (vpLeft + vpWidth < 0 || vpLeft > viewportWidth) continue;
          if (vpTop + vpHeight < 0 || vpTop > viewportHeight) continue;

          result.push({
            text: item.str,
            rect: {
              x: Math.max(0, vpLeft / viewportWidth),
              y: Math.max(0, vpTop / viewportHeight),
              w: Math.min(1 - Math.max(0, vpLeft / viewportWidth), vpWidth / viewportWidth),
              h: Math.min(
                1 - Math.max(0, vpTop / viewportHeight),
                (vpHeight * 1.25) / viewportHeight,
              ),
            },
            fontSize,
          });
        }
        setHits(result);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [page, scale, active, viewportWidth, viewportHeight]);

  // Auto-focus the textarea when popup opens.
  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const confirmEdit = (): void => {
    if (!editing) return;
    const { hit, value } = editing;
    const trimmed = value.trim();
    if (!trimmed) {
      setEditing(null);
      return;
    }
    const annot: TextEditAnnot = {
      kind: "textedit",
      id: crypto.randomUUID(),
      page: pageIndex,
      color: "#000000",
      rect: hit.rect,
      originalText: hit.text,
      newText: trimmed,
      fontSize: hit.fontSize,
    };
    onAdd(annot);
    setEditing(null);
  };

  if (!active) return <></>;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      {/* Clickable hit zones over each text item */}
      {hits.map((hit, i) => (
        <div
          key={i}
          title={`クリックして編集: "${hit.text}"`}
          onPointerDown={(e) => {
            e.stopPropagation();
            setEditing({ hit, value: hit.text });
          }}
          style={{
            position: "absolute",
            left: `${hit.rect.x * 100}%`,
            top: `${hit.rect.y * 100}%`,
            width: `${hit.rect.w * 100}%`,
            height: `${hit.rect.h * 100}%`,
            cursor: "text",
            pointerEvents: "auto",
            background: "rgba(14, 165, 233, 0.07)",
            border: "1px solid rgba(14, 165, 233, 0.25)",
            borderRadius: 2,
            boxSizing: "border-box",
            transition: "background 0.1s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = "rgba(14, 165, 233, 0.18)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = "rgba(14, 165, 233, 0.07)";
          }}
        />
      ))}

      {/* Inline edit popup */}
      {editing && (
        <div
          style={{
            position: "absolute",
            left: `${Math.min(0.6, editing.hit.rect.x) * 100}%`,
            top: `${Math.min(0.78, editing.hit.rect.y + editing.hit.rect.h + 0.01) * 100}%`,
            background: "#fff",
            border: "1.5px solid #0284c7",
            borderRadius: 8,
            padding: "10px 12px",
            boxShadow: "0 6px 24px rgba(0,0,0,.22)",
            zIndex: 200,
            minWidth: 240,
            maxWidth: 340,
            pointerEvents: "auto",
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, lineHeight: 1.4 }}>
            元のテキスト:{" "}
            <span
              style={{
                fontStyle: "italic",
                background: "#fef9c3",
                padding: "0 3px",
                borderRadius: 2,
              }}
            >
              {editing.hit.text}
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={editing.value}
            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                confirmEdit();
              }
              if (e.key === "Escape") setEditing(null);
            }}
            placeholder="新しいテキストを入力…"
            rows={2}
            style={{
              width: "100%",
              fontSize: 13,
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              padding: "5px 7px",
              resize: "vertical",
              display: "block",
              boxSizing: "border-box",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 8,
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 10, color: "#94a3b8", marginRight: "auto" }}>
              Enter で確定 / Esc でキャンセル
            </span>
            <button
              onClick={() => setEditing(null)}
              style={{
                fontSize: 12,
                padding: "3px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                background: "#fff",
                cursor: "pointer",
                color: "#374151",
              }}
            >
              キャンセル
            </button>
            <button
              onClick={confirmEdit}
              style={{
                fontSize: 12,
                padding: "3px 12px",
                border: "none",
                borderRadius: 4,
                background: "#0284c7",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              確定
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
