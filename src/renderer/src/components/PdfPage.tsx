import { useEffect, useRef, useState } from "react";
import type { PDFPageProxy } from "pdfjs-dist";
import type { Stamp } from "../lib/types";
import { clamp01 } from "../lib/geometry";

interface Props {
  page: PDFPageProxy;
  pageIndex: number;
  stamps: Stamp[];
  placing: boolean;
  onPlace: (pageIndex: number, x: number, y: number) => void;
  onUpdate: (
    id: string,
    partial: Partial<Pick<Stamp, "x" | "y" | "w">>,
  ) => void;
  onRemove: (id: string) => void;
}

export function PdfPage({
  page,
  pageIndex,
  stamps,
  placing,
  onPlace,
  onUpdate,
  onRemove,
}: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const viewport = page.getViewport({ scale: 1.2 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const task = page.render({ canvasContext: ctx, viewport });
    task.promise.catch(() => {
      /* render cancelled on unmount / re-render */
    });
    return () => {
      task.cancel();
    };
  }, [page]);

  const handleClick = (e: React.MouseEvent): void => {
    if (!placing) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clamp01((e.clientX - rect.left) / rect.width);
    const y = clamp01((e.clientY - rect.top) / rect.height);
    onPlace(pageIndex, x, y);
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{
        position: "relative",
        margin: "0 auto 14px",
        width: "fit-content",
        cursor: placing ? "copy" : "default",
        boxShadow: "0 1px 6px rgba(0,0,0,.25)",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
      {stamps.map((s) => (
        <StampBox
          key={s.id}
          stamp={s}
          containerRef={containerRef}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

function StampBox({
  stamp,
  containerRef,
  onUpdate,
  onRemove,
}: {
  stamp: Stamp;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onUpdate: Props["onUpdate"];
  onRemove: Props["onRemove"];
}): React.JSX.Element {
  const [selected, setSelected] = useState(false);

  const startDrag = (e: React.PointerEvent): void => {
    e.stopPropagation();
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const downX = e.clientX;
    const downY = e.clientY;
    const startX = stamp.x;
    const startY = stamp.y;
    const move = (ev: PointerEvent): void => {
      onUpdate(stamp.id, {
        x: clamp01(startX + (ev.clientX - downX) / rect.width),
        y: clamp01(startY + (ev.clientY - downY) / rect.height),
      });
    };
    const up = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startResize = (e: React.PointerEvent): void => {
    e.stopPropagation();
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const downX = e.clientX;
    const startW = stamp.w;
    const move = (ev: PointerEvent): void => {
      const next = startW + (ev.clientX - downX) / rect.width;
      onUpdate(stamp.id, { w: Math.min(0.8, Math.max(0.03, next)) });
    };
    const up = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      onPointerDown={startDrag}
      onClick={(e) => {
        e.stopPropagation();
        setSelected((v) => !v);
      }}
      style={{
        position: "absolute",
        left: `${stamp.x * 100}%`,
        top: `${stamp.y * 100}%`,
        width: `${stamp.w * 100}%`,
        cursor: "move",
        outline: selected ? "1.5px dashed #2563eb" : "none",
        touchAction: "none",
      }}
    >
      <img
        src={stamp.src}
        alt="stamp"
        draggable={false}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          pointerEvents: "none",
        }}
      />
      {selected && (
        <>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(stamp.id);
            }}
            title="削除"
            style={{
              position: "absolute",
              top: -10,
              right: -10,
              width: 20,
              height: 20,
              borderRadius: "50%",
              border: "none",
              background: "#dc2626",
              color: "#fff",
              fontSize: 12,
              lineHeight: "20px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
          <div
            onPointerDown={startResize}
            title="リサイズ"
            style={{
              position: "absolute",
              right: -7,
              bottom: -7,
              width: 14,
              height: 14,
              borderRadius: 3,
              background: "#2563eb",
              cursor: "nwse-resize",
            }}
          />
        </>
      )}
    </div>
  );
}
