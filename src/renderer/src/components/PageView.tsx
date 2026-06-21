import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFPageProxy } from "pdfjs-dist";
import type { Stamp } from "../lib/types";
import { clamp01 } from "../lib/geometry";
import { buildTileGrid } from "../lib/viewer/tile-grid";
import type { TileRect } from "../lib/viewer/types";
import { LARGE_PAGE_THRESHOLD } from "../lib/viewer/types";
import { snapToLOD, lodCacheKey } from "../lib/viewer/lod";
import { globalTileCache } from "../lib/viewer/tile-cache";
import { scheduleRender } from "../lib/viewer/render-scheduler";

export const DEFAULT_SCALE = 1.2;

interface PageViewProps {
  page: PDFPageProxy;
  pageIndex: number;
  stamps: Stamp[];
  placing: boolean;
  scale?: number;
  onPlace: (pageIndex: number, x: number, y: number) => void;
  onUpdate: (
    id: string,
    partial: Partial<Pick<Stamp, "x" | "y" | "w">>,
  ) => void;
  onRemove: (id: string) => void;
}

/**
 * Renders one PDF page using the appropriate strategy:
 *   - SingleCanvasStrategy: single <canvas> covering the whole page (A4/A3)
 *   - TiledStrategy: grid of 1024×1024 tiles (A1/A0 and larger)
 *
 * Stamp overlays use fractional positioning (0..1) and are unaffected by which
 * strategy is active.
 */
export function PageView({
  page,
  pageIndex,
  stamps,
  placing,
  scale = DEFAULT_SCALE,
  onPlace,
  onUpdate,
  onRemove,
}: PageViewProps): React.JSX.Element {
  const viewport = useMemo(() => page.getViewport({ scale }), [page, scale]);
  const containerRef = useRef<HTMLDivElement>(null);

  const useTile =
    viewport.width > LARGE_PAGE_THRESHOLD ||
    viewport.height > LARGE_PAGE_THRESHOLD;

  const handleClick = (e: React.MouseEvent): void => {
    if (!placing) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    onPlace(
      pageIndex,
      clamp01((e.clientX - rect.left) / rect.width),
      clamp01((e.clientY - rect.top) / rect.height),
    );
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{
        position: "relative",
        margin: "0 auto 14px",
        width: viewport.width,
        height: viewport.height,
        cursor: placing ? "copy" : "default",
        boxShadow: "0 1px 6px rgba(0,0,0,.25)",
        overflow: "hidden",
      }}
    >
      {useTile ? (
        <TiledCanvasLayer
          page={page}
          pageIndex={pageIndex}
          viewport={viewport}
          displayScale={scale}
        />
      ) : (
        <SingleCanvas page={page} viewport={viewport} />
      )}

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

// ---------------------------------------------------------------------------
// SingleCanvasStrategy — existing behaviour, preserves A4 regression-free path
// ---------------------------------------------------------------------------

function SingleCanvas({
  page,
  viewport,
}: {
  page: PDFPageProxy;
  viewport: ReturnType<PDFPageProxy["getViewport"]>;
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const task = page.render({ canvasContext: ctx, viewport });
    task.promise.catch(() => {});
    return () => {
      task.cancel();
    };
  }, [page, viewport]);

  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}

// ---------------------------------------------------------------------------
// TiledStrategy PoC — pdfjs transform-based tile rendering for large pages
// ---------------------------------------------------------------------------

function TiledCanvasLayer({
  page,
  pageIndex,
  viewport,
  displayScale,
}: {
  page: PDFPageProxy;
  pageIndex: number;
  viewport: ReturnType<PDFPageProxy["getViewport"]>;
  displayScale: number;
}): React.JSX.Element {
  const grid = useMemo(
    () => buildTileGrid(viewport.width, viewport.height),
    [viewport.width, viewport.height],
  );

  return (
    <>
      {grid.tiles.map((tile) => (
        <TileCanvas
          key={`${tile.col}-${tile.row}`}
          page={page}
          pageIndex={pageIndex}
          viewport={viewport}
          tile={tile}
          displayScale={displayScale}
        />
      ))}
    </>
  );
}

function TileCanvas({
  page,
  pageIndex,
  viewport,
  tile,
  displayScale,
}: {
  page: PDFPageProxy;
  pageIndex: number;
  viewport: ReturnType<PDFPageProxy["getViewport"]>;
  tile: TileRect;
  displayScale: number;
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // LOD: snap render scale to nearest anchor ≥ display scale.
    const lodScale = snapToLOD(displayScale);
    const ratio = lodScale / displayScale;
    const renderW = Math.round(tile.w * ratio);
    const renderH = Math.round(tile.h * ratio);
    const cacheKey = `${pageIndex}-${tile.col}-${tile.row}-${lodCacheKey(displayScale)}`;

    // --- Cache hit: draw immediately ---
    const cached = globalTileCache.get(cacheKey);
    if (cached) {
      canvas.width = tile.w;
      canvas.height = tile.h;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(cached, 0, 0, tile.w, tile.h);
      return;
    }

    // --- Cache miss: schedule render ---
    let cancelled = false;
    let renderTask: { promise: Promise<void>; cancel(): void } | null = null;

    scheduleRender(async () => {
      if (cancelled) return;

      const lodViewport = page.getViewport({ scale: lodScale });
      const offscreen = new OffscreenCanvas(renderW, renderH);
      const ctx = offscreen.getContext("2d") as unknown as CanvasRenderingContext2D;

      // Shift so only this tile's region is drawn into the offscreen canvas.
      const transform: [number, number, number, number, number, number] = [
        1, 0, 0, 1, -Math.round(tile.x * ratio), -Math.round(tile.y * ratio),
      ];

      renderTask = page.render({ canvasContext: ctx, viewport: lodViewport, transform });
      await renderTask.promise;
      if (cancelled) return;

      const bitmap = await createImageBitmap(offscreen);
      globalTileCache.set(cacheKey, bitmap, renderW, renderH);

      // Draw scaled to the display tile size.
      canvas.width = tile.w;
      canvas.height = tile.h;
      const visCtx = canvas.getContext("2d");
      visCtx?.drawImage(bitmap, 0, 0, tile.w, tile.h);
    }).catch(() => {});

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [page, pageIndex, viewport, tile, displayScale]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        left: tile.x,
        top: tile.y,
        display: "block",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Shared StampBox overlay — identical for both strategies
// ---------------------------------------------------------------------------

function StampBox({
  stamp,
  containerRef,
  onUpdate,
  onRemove,
}: {
  stamp: Stamp;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onUpdate: PageViewProps["onUpdate"];
  onRemove: PageViewProps["onRemove"];
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
