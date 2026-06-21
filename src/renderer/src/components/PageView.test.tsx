import { vi, describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── グローバルスタブ（OffscreenCanvas / createImageBitmap は jsdom 未実装）

beforeAll(() => {
  if (typeof OffscreenCanvas === "undefined") {
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        width: number;
        height: number;
        constructor(w: number, h: number) {
          this.width = w;
          this.height = h;
        }
        getContext() {
          return {
            drawImage: vi.fn(),
            scale: vi.fn(),
            translate: vi.fn(),
          };
        }
      },
    );
  }
  if (typeof createImageBitmap === "undefined") {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({} as ImageBitmap));
  }
});

// ── Tauri プラグインスタブ（PageView が間接的に依存する可能性のある場合）

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeFile: vi.fn() }));

// ── TileCache / RenderScheduler をモック

vi.mock("../lib/viewer/tile-cache", () => ({
  globalTileCache: {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    evict: vi.fn(),
  },
}));

vi.mock("../lib/viewer/render-scheduler", () => ({
  scheduleRender: vi.fn().mockReturnValue(Promise.resolve()),
}));

// ── PageView を import（モック宣言の後）

import { PageView, DEFAULT_SCALE } from "./PageView";
import { LARGE_PAGE_THRESHOLD } from "../lib/viewer/types";

// ── ページ stub ファクトリ

function makePage(w: number, h: number) {
  return {
    getViewport: vi.fn().mockReturnValue({ width: w, height: h, scale: DEFAULT_SCALE }),
    render: vi.fn().mockReturnValue({ promise: Promise.resolve(), cancel: vi.fn() }),
    cleanup: vi.fn(),
  };
}

const EMPTY_STAMPS: never[] = [];
const NOOP = vi.fn();

// ─────────────────────────────────────────────────────────────

describe("PageView — strategy 選択", () => {
  it("小ページ (595×842) → SingleCanvas: canvas 1 枚・絶対配置なし", () => {
    const page = makePage(595, 842);
    const { container } = render(
      <PageView
        page={page as never}
        pageIndex={0}
        stamps={EMPTY_STAMPS}
        placing={false}
        scale={DEFAULT_SCALE}
        onPlace={NOOP}
        onUpdate={NOOP}
        onRemove={NOOP}
      />,
    );

    const canvases = container.querySelectorAll("canvas");
    expect(canvases.length).toBe(1);
    // SingleCanvas の canvas は absolute でない
    expect(canvases[0].style.position).not.toBe("absolute");
  });

  it(`大ページ (${LARGE_PAGE_THRESHOLD + 1}×2000) → TiledCanvasLayer: canvas 複数・absolute`, () => {
    const page = makePage(LARGE_PAGE_THRESHOLD + 1, 2000);
    const { container } = render(
      <PageView
        page={page as never}
        pageIndex={0}
        stamps={EMPTY_STAMPS}
        placing={false}
        scale={DEFAULT_SCALE}
        onPlace={NOOP}
        onUpdate={NOOP}
        onRemove={NOOP}
      />,
    );

    const canvases = container.querySelectorAll("canvas");
    expect(canvases.length).toBeGreaterThan(1);
    // すべてのタイル canvas は position: absolute
    canvases.forEach((c) => expect(c.style.position).toBe("absolute"));
  });

  it(`大ページ (2000×${LARGE_PAGE_THRESHOLD + 1}) → TiledCanvasLayer (高さ起因)`, () => {
    const page = makePage(2000, LARGE_PAGE_THRESHOLD + 1);
    const { container } = render(
      <PageView
        page={page as never}
        pageIndex={0}
        stamps={EMPTY_STAMPS}
        placing={false}
        scale={DEFAULT_SCALE}
        onPlace={NOOP}
        onUpdate={NOOP}
        onRemove={NOOP}
      />,
    );

    const canvases = container.querySelectorAll("canvas");
    expect(canvases.length).toBeGreaterThan(1);
  });
});

describe("PageView — クリック (placing 制御)", () => {
  it("placing=true のとき onPlace が呼ばれる", () => {
    const onPlace = vi.fn();
    const page = makePage(595, 842);
    const { container } = render(
      <PageView
        page={page as never}
        pageIndex={2}
        stamps={EMPTY_STAMPS}
        placing={true}
        scale={DEFAULT_SCALE}
        onPlace={onPlace}
        onUpdate={NOOP}
        onRemove={NOOP}
      />,
    );

    const div = container.firstElementChild as HTMLElement;
    fireEvent.click(div, { clientX: 100, clientY: 200 });
    expect(onPlace).toHaveBeenCalledOnce();
    // 第1引数は pageIndex
    expect(onPlace.mock.calls[0][0]).toBe(2);
  });

  it("placing=false のとき onPlace は呼ばれない", () => {
    const onPlace = vi.fn();
    const page = makePage(595, 842);
    const { container } = render(
      <PageView
        page={page as never}
        pageIndex={0}
        stamps={EMPTY_STAMPS}
        placing={false}
        scale={DEFAULT_SCALE}
        onPlace={onPlace}
        onUpdate={NOOP}
        onRemove={NOOP}
      />,
    );

    const div = container.firstElementChild as HTMLElement;
    fireEvent.click(div, { clientX: 100, clientY: 200 });
    expect(onPlace).not.toHaveBeenCalled();
  });
});

describe("PageView — スタンプ表示", () => {
  it("スタンプが指定位置に img として描画される", () => {
    const page = makePage(595, 842);
    const stamps = [
      { id: "s1", src: "data:image/png;base64,ABC", x: 0.2, y: 0.3, w: 0.1 },
    ];

    render(
      <PageView
        page={page as never}
        pageIndex={0}
        stamps={stamps as never}
        placing={false}
        scale={DEFAULT_SCALE}
        onPlace={NOOP}
        onUpdate={NOOP}
        onRemove={NOOP}
      />,
    );

    const img = screen.getByAltText("stamp") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain("data:image/png;base64,ABC");
  });

  it("スタンプなしのとき img は存在しない", () => {
    const page = makePage(595, 842);
    render(
      <PageView
        page={page as never}
        pageIndex={0}
        stamps={EMPTY_STAMPS}
        placing={false}
        scale={DEFAULT_SCALE}
        onPlace={NOOP}
        onUpdate={NOOP}
        onRemove={NOOP}
      />,
    );

    expect(screen.queryByAltText("stamp")).not.toBeInTheDocument();
  });

  it("スタンプクリック → 削除ボタン (×) が表示される", () => {
    const page = makePage(595, 842);
    const stamps = [
      { id: "s2", src: "data:image/png;base64,XYZ", x: 0.5, y: 0.5, w: 0.15 },
    ];

    const { container } = render(
      <PageView
        page={page as never}
        pageIndex={0}
        stamps={stamps as never}
        placing={false}
        scale={DEFAULT_SCALE}
        onPlace={NOOP}
        onUpdate={NOOP}
        onRemove={NOOP}
      />,
    );

    // スタンプの親 div（move cursor）をクリックして selected にする
    const stampDiv = container.querySelector('[style*="move"]') as HTMLElement;
    fireEvent.click(stampDiv);

    expect(screen.getByTitle("削除")).toBeInTheDocument();
  });
});
