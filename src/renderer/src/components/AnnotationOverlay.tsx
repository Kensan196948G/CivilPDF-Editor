import { useCallback, useRef, useState } from "react";
import type { Annotation, FracPoint, InkAnnot, NoteAnnot, RectAnnot, TextEditAnnot } from "../lib/annotations/types";
import type { AnnotTool } from "./AnnotToolbar";
import { clamp01 } from "../lib/geometry";

interface Props {
  pageIndex: number;
  annotations: Annotation[];
  activeTool: AnnotTool | null;
  activeColor: string;
  viewportWidth: number;
  viewportHeight: number;
  onAdd: (annot: Annotation) => void;
  onRemove: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function RectAnnotSvg({ annot, onErase }: { annot: RectAnnot; onErase?: (id: string) => void }): React.JSX.Element {
  const onClick = onErase ? (e: React.MouseEvent) => { e.stopPropagation(); onErase(annot.id); } : undefined;

  return (
    <g onClick={onClick} style={{ cursor: onErase ? "pointer" : "default" }}>
      {annot.rects.map((r, i) => {
        if (annot.kind === "highlight") {
          return (
            <rect
              key={i}
              x={`${r.x * 100}%`}
              y={`${r.y * 100}%`}
              width={`${r.w * 100}%`}
              height={`${r.h * 100}%`}
              fill={annot.color}
              fillOpacity={0.35}
            />
          );
        }
        if (annot.kind === "underline") {
          const y = `${(r.y + r.h) * 100}%`;
          return (
            <line
              key={i}
              x1={`${r.x * 100}%`}
              y1={y}
              x2={`${(r.x + r.w) * 100}%`}
              y2={y}
              stroke={annot.color}
              strokeWidth="1.5"
            />
          );
        }
        // strikeout
        const midY = `${(r.y + r.h * 0.5) * 100}%`;
        return (
          <line
            key={i}
            x1={`${r.x * 100}%`}
            y1={midY}
            x2={`${(r.x + r.w) * 100}%`}
            y2={midY}
            stroke={annot.color}
            strokeWidth="1.5"
          />
        );
      })}
    </g>
  );
}

function NoteAnnotSvg({ annot, onErase }: { annot: NoteAnnot; onErase?: (id: string) => void }): React.JSX.Element {
  const onClick = onErase ? (e: React.MouseEvent) => { e.stopPropagation(); onErase(annot.id); } : undefined;
  return (
    <g onClick={onClick} style={{ cursor: onErase ? "pointer" : "default" }}>
      <rect
        x={`${annot.x * 100}%`}
        y={`${annot.y * 100}%`}
        width="24"
        height="24"
        rx="3"
        fill={annot.color}
        fillOpacity={0.85}
      />
      <text
        x={`${annot.x * 100}%`}
        dx={12}
        y={`${annot.y * 100}%`}
        dy={16}
        textAnchor="middle"
        fontSize="14"
        fill="#333"
      >
        📌
      </text>
      {annot.text && (
        <title>{annot.text}</title>
      )}
    </g>
  );
}

function InkAnnotSvg({ annot, onErase }: { annot: InkAnnot; onErase?: (id: string) => void }): React.JSX.Element {
  const onClick = onErase ? (e: React.MouseEvent) => { e.stopPropagation(); onErase(annot.id); } : undefined;
  const strokeW = `${annot.width * 100}%`;
  return (
    <g onClick={onClick} style={{ cursor: onErase ? "pointer" : "default" }}>
      {annot.strokes.map((stroke, i) => {
        if (stroke.length < 2) return null;
        const d = stroke
          .map((pt, j) => `${j === 0 ? "M" : "L"} ${pt.x * 100}% ${pt.y * 100}%`)
          .join(" ");
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={annot.color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </g>
  );
}

/**
 * On-screen preview of a text edit: a white rectangle (whiteout) over the
 * original text, with the replacement text drawn on top. Mirrors what
 * {@link embedAnnotationsIntoPdf} burns into the PDF, so the user sees the edit
 * immediately. SVG <text> uses the system font, so Japanese renders on screen.
 */
function TextEditAnnotSvg({
  annot,
  viewportHeight,
  onErase,
}: {
  annot: TextEditAnnot;
  viewportHeight: number;
  onErase?: (id: string) => void;
}): React.JSX.Element {
  const onClick = onErase ? (e: React.MouseEvent) => { e.stopPropagation(); onErase(annot.id); } : undefined;
  const r = annot.rect;
  // Match the original: same font height and same baseline (both page-height
  // fractions, so they scale with the viewport).
  const fontPx = Math.max(6, annot.fontHeightFrac * viewportHeight);
  return (
    <g onClick={onClick} style={{ cursor: onErase ? "pointer" : "default" }}>
      <rect
        x={`${r.x * 100}%`}
        y={`${r.y * 100}%`}
        width={`${r.w * 100}%`}
        height={`${r.h * 100}%`}
        fill="#ffffff"
      />
      <text
        x={`${r.x * 100}%`}
        dx={1}
        y={`${annot.baselineFrac * 100}%`}
        fontSize={fontPx}
        fill="#000000"
      >
        {annot.newText}
      </text>
      {annot.originalText && <title>元: {annot.originalText}</title>}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Drawing state
// ---------------------------------------------------------------------------

interface RectDraft { startX: number; startY: number; endX: number; endY: number }
interface InkDraft { strokes: FracPoint[][]; current: FracPoint[] }
interface NoteDraft { x: number; y: number }

// ---------------------------------------------------------------------------
// Main overlay component
// ---------------------------------------------------------------------------

export function AnnotationOverlay({
  pageIndex,
  annotations,
  activeTool,
  activeColor,
  viewportWidth,
  viewportHeight,
  onAdd,
  onRemove,
}: Props): React.JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const [rectDraft, setRectDraft] = useState<RectDraft | null>(null);
  const [inkDraft, setInkDraft] = useState<InkDraft | null>(null);
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null);
  const [noteText, setNoteText] = useState("");

  const toFrac = useCallback((clientX: number, clientY: number): FracPoint => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clamp01((clientX - rect.left) / rect.width), y: clamp01((clientY - rect.top) / rect.height) };
  }, []);

  // Pointer events for drawing
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>): void => {
    if (!activeTool || activeTool === "erase") return;
    e.preventDefault();
    const pt = toFrac(e.clientX, e.clientY);

    if (activeTool === "highlight" || activeTool === "underline" || activeTool === "strikeout") {
      setRectDraft({ startX: pt.x, startY: pt.y, endX: pt.x, endY: pt.y });
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    } else if (activeTool === "ink") {
      setInkDraft({ strokes: [], current: [pt] });
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    } else if (activeTool === "note") {
      setNoteDraft({ x: pt.x, y: pt.y });
      setNoteText("");
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>): void => {
    if (!activeTool) return;
    const pt = toFrac(e.clientX, e.clientY);

    if (rectDraft) {
      setRectDraft((d) => d ? { ...d, endX: pt.x, endY: pt.y } : null);
    } else if (inkDraft) {
      setInkDraft((d) => d ? { ...d, current: [...d.current, pt] } : null);
    }
  };

  const onPointerUp = (): void => {
    if (rectDraft && activeTool && (activeTool === "highlight" || activeTool === "underline" || activeTool === "strikeout")) {
      const x = Math.min(rectDraft.startX, rectDraft.endX);
      const y = Math.min(rectDraft.startY, rectDraft.endY);
      const w = Math.abs(rectDraft.endX - rectDraft.startX);
      const h = Math.abs(rectDraft.endY - rectDraft.startY);
      if (w > 0.01 && h > 0.005) {
        const annot: RectAnnot = {
          id: crypto.randomUUID(),
          page: pageIndex,
          kind: activeTool as RectAnnot["kind"],
          color: activeColor,
          rects: [{ x, y, w, h }],
        };
        onAdd(annot);
      }
      setRectDraft(null);
    }

    if (inkDraft && activeTool === "ink") {
      const done = inkDraft.current.length >= 2
        ? [...inkDraft.strokes, inkDraft.current]
        : inkDraft.strokes;
      if (done.length > 0 && done.some((s) => s.length >= 2)) {
        const annot: InkAnnot = {
          id: crypto.randomUUID(),
          page: pageIndex,
          kind: "ink",
          color: activeColor,
          strokes: done,
          width: 0.003, // ~0.3% of page width
        };
        onAdd(annot);
      }
      setInkDraft(null);
    }
  };

  const commitNote = (): void => {
    if (!noteDraft) return;
    const annot: NoteAnnot = {
      id: crypto.randomUUID(),
      page: pageIndex,
      kind: "note",
      color: activeColor,
      x: noteDraft.x,
      y: noteDraft.y,
      text: noteText,
    };
    onAdd(annot);
    setNoteDraft(null);
    setNoteText("");
  };

  const isErasing = activeTool === "erase";

  const cursor = (): string => {
    if (!activeTool) return "default";
    if (activeTool === "erase") return "cell";
    if (activeTool === "note") return "text";
    return "crosshair";
  };

  return (
    <>
      <svg
        ref={svgRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: viewportWidth,
          height: viewportHeight,
          cursor: cursor(),
          pointerEvents: activeTool ? "auto" : "none",
          overflow: "visible",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Render persisted annotations */}
        {annotations.map((a) => {
          const erase = isErasing ? onRemove : undefined;
          if (a.kind === "highlight" || a.kind === "underline" || a.kind === "strikeout") {
            return <RectAnnotSvg key={a.id} annot={a} onErase={erase} />;
          }
          if (a.kind === "note") return <NoteAnnotSvg key={a.id} annot={a} onErase={erase} />;
          if (a.kind === "ink") return <InkAnnotSvg key={a.id} annot={a} onErase={erase} />;
          if (a.kind === "textedit") {
            return (
              <TextEditAnnotSvg
                key={a.id}
                annot={a}
                viewportHeight={viewportHeight}
                onErase={erase}
              />
            );
          }
          return null;
        })}

        {/* Live rect draft preview */}
        {rectDraft && (
          <rect
            x={`${Math.min(rectDraft.startX, rectDraft.endX) * 100}%`}
            y={`${Math.min(rectDraft.startY, rectDraft.endY) * 100}%`}
            width={`${Math.abs(rectDraft.endX - rectDraft.startX) * 100}%`}
            height={`${Math.abs(rectDraft.endY - rectDraft.startY) * 100}%`}
            fill={activeColor}
            fillOpacity={0.2}
            stroke={activeColor}
            strokeWidth={1}
            strokeDasharray="4"
          />
        )}

        {/* Live ink draft preview */}
        {inkDraft && inkDraft.current.length >= 2 && (
          <path
            d={inkDraft.current.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x * 100}% ${pt.y * 100}%`).join(" ")}
            fill="none"
            stroke={activeColor}
            strokeWidth="0.3%"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
          />
        )}
      </svg>

      {/* Note text input popup */}
      {noteDraft && (
        <div
          style={{
            position: "absolute",
            left: `${noteDraft.x * 100}%`,
            top: `${noteDraft.y * 100}%`,
            zIndex: 20,
            background: activeColor,
            border: "1px solid #aaa",
            borderRadius: 4,
            padding: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,.25)",
            minWidth: 160,
          }}
        >
          <textarea
            autoFocus
            rows={3}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="メモを入力..."
            style={{ display: "block", width: "100%", fontSize: 12, resize: "both", border: "1px solid #ccc", borderRadius: 2, padding: 4 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitNote(); }
              if (e.key === "Escape") { setNoteDraft(null); }
            }}
          />
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            <button onClick={commitNote} style={{ fontSize: 11, padding: "2px 8px", cursor: "pointer" }}>確定</button>
            <button onClick={() => setNoteDraft(null)} style={{ fontSize: 11, padding: "2px 8px", cursor: "pointer" }}>キャンセル</button>
          </div>
        </div>
      )}
    </>
  );
}
