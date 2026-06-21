import { vi, describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ZoomControls, DEFAULT_SCALE } from "./ZoomControls";

describe("ZoomControls — 表示", () => {
  it("初期倍率 1.2 → 100% と表示される", () => {
    render(<ZoomControls scale={DEFAULT_SCALE} onScale={vi.fn()} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("scale=0.5 → 42% と表示される (0.5/1.2 * 100 = 41.67 → 42)", () => {
    render(<ZoomControls scale={0.5} onScale={vi.fn()} />);
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("scale=2.4 → 200% と表示される", () => {
    render(<ZoomControls scale={2.4} onScale={vi.fn()} />);
    expect(screen.getByText("200%")).toBeInTheDocument();
  });
});

describe("ZoomControls — 拡大・縮小ボタン", () => {
  it("拡大ボタンクリック → scale + 0.25 で onScale が呼ばれる", () => {
    const onScale = vi.fn();
    render(<ZoomControls scale={1.2} onScale={onScale} />);
    fireEvent.click(screen.getByTitle("拡大"));
    expect(onScale).toHaveBeenCalledWith(1.45);
  });

  it("縮小ボタンクリック → scale - 0.25 で onScale が呼ばれる", () => {
    const onScale = vi.fn();
    render(<ZoomControls scale={1.2} onScale={onScale} />);
    fireEvent.click(screen.getByTitle("縮小"));
    expect(onScale).toHaveBeenCalledWith(0.95);
  });

  it("リセットボタンクリック → DEFAULT_SCALE (1.2) で onScale が呼ばれる", () => {
    const onScale = vi.fn();
    render(<ZoomControls scale={2.0} onScale={onScale} />);
    fireEvent.click(screen.getByText("リセット"));
    expect(onScale).toHaveBeenCalledWith(DEFAULT_SCALE);
  });
});

describe("ZoomControls — ボタン disabled 制御", () => {
  it("scale が MIN (0.5) のとき縮小ボタンは disabled", () => {
    render(<ZoomControls scale={0.5} onScale={vi.fn()} />);
    expect(screen.getByTitle("縮小")).toBeDisabled();
    expect(screen.getByTitle("拡大")).not.toBeDisabled();
  });

  it("scale が MAX (4.0) のとき拡大ボタンは disabled", () => {
    render(<ZoomControls scale={4.0} onScale={vi.fn()} />);
    expect(screen.getByTitle("拡大")).toBeDisabled();
    expect(screen.getByTitle("縮小")).not.toBeDisabled();
  });

  it("中間 scale では両ボタンが enabled", () => {
    render(<ZoomControls scale={1.5} onScale={vi.fn()} />);
    expect(screen.getByTitle("拡大")).not.toBeDisabled();
    expect(screen.getByTitle("縮小")).not.toBeDisabled();
  });
});
