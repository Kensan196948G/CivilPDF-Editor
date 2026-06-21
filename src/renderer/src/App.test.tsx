import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { DocumentState } from "./lib/document/types";
import { initialDocumentState } from "./lib/document/types";

// ── controllable fake document controller ──────────────────────────────────
const controller = {
  state: initialDocumentState() as DocumentState,
  canSave: false,
  open: vi.fn(),
  save: vi.fn(),
  saveAs: vi.fn(),
  finalize: vi.fn(),
  exportDocx: vi.fn(),
  exportImages: vi.fn(),
  print: vi.fn(),
  rotate: vi.fn(),
  removePages: vi.fn(),
  reorder: vi.fn(),
  insertFromFile: vi.fn(),
  addStamp: vi.fn(),
  updateStamp: vi.fn(),
  removeStamp: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  comment: vi.fn(),
  addAnnotation: vi.fn(),
  removeAnnotation: vi.fn(),
  applyOcr: vi.fn(),
  setScale: vi.fn(),
  select: vi.fn(),
};

vi.mock("./lib/document/useDocument", () => ({
  useDocument: () => controller,
}));

const useAppMenuSpy = vi.fn();
vi.mock("./hooks/useAppMenu", () => ({
  useAppMenu: (...args: unknown[]) => useAppMenuSpy(...args),
}));

vi.mock("./components/PageView", () => ({
  PageView: ({
    pageIndex,
    placing,
    onPlace,
  }: {
    pageIndex: number;
    placing: boolean;
    onPlace: (pageIndex: number, x: number, y: number) => void;
  }) => (
    <div
      data-testid={`pdf-page-${pageIndex}`}
      onClick={() => placing && onPlace(pageIndex, 0.5, 0.5)}
    >
      Page {pageIndex + 1}
    </div>
  ),
}));

vi.mock("./components/ZoomControls", () => ({
  ZoomControls: () => <div data-testid="zoom-controls" />,
}));

vi.mock("./components/OcrPanel", () => ({
  OcrPanel: () => <div data-testid="ocr-panel" />,
}));

vi.mock("./components/StampToolbar", () => ({
  StampToolbar: ({
    onSetTemplate,
  }: {
    onSetTemplate: (t: { src: string; ratio: number }) => void;
  }) => (
    <button
      data-testid="set-template"
      onClick={() => onSetTemplate({ src: "data:image/png;base64,AAAA", ratio: 1 })}
    >
      Set Template
    </button>
  ),
}));

import { App } from "./App";

function openDoc(pages = 2): void {
  controller.state = {
    ...initialDocumentState(),
    filePath: "/home/user/test.pdf",
    fileName: "test.pdf",
    docBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    pages: Array.from({ length: pages }, () => ({}) as never),
  };
  controller.canSave = true;
}

beforeEach(() => {
  controller.state = initialDocumentState();
  controller.canSave = false;
  vi.clearAllMocks();
});

describe("App — 初期状態", () => {
  it("未選択時: 開くボタンあり、保存ボタン非表示、プレースホルダー表示", () => {
    render(<App />);
    expect(screen.getByText("PDF を開く")).toBeInTheDocument();
    expect(screen.queryByText("確定保存")).not.toBeInTheDocument();
    expect(screen.getByText(/PDF を開いて編集・押印・変換します/)).toBeInTheDocument();
  });

  it("ネイティブメニューを canSave とともに登録する", () => {
    render(<App />);
    expect(useAppMenuSpy).toHaveBeenCalled();
    const lastCall = useAppMenuSpy.mock.calls.at(-1)!;
    expect(lastCall[1]).toBe(false); // canSave
  });
});

describe("App — open フロー", () => {
  it("「PDF を開く」クリックで controller.open を呼ぶ", () => {
    render(<App />);
    fireEvent.click(screen.getByText("PDF を開く"));
    expect(controller.open).toHaveBeenCalledTimes(1);
  });
});

describe("App — ドキュメント表示", () => {
  it("PDF 読込済み: ファイル名・全2ページ・保存/確定保存・レビューパネル表示", () => {
    openDoc(2);
    render(<App />);
    expect(screen.getByText(/全 2 ページ/)).toBeInTheDocument();
    expect(screen.getByText(/test\.pdf/)).toBeInTheDocument();
    expect(screen.getByText("確定保存")).toBeInTheDocument();
    expect(screen.getByText(/印鑑レビュー/)).toBeInTheDocument();
  });

  it("「保存」クリックで controller.save を呼ぶ", () => {
    openDoc();
    render(<App />);
    fireEvent.click(screen.getByText(/^保存/));
    expect(controller.save).toHaveBeenCalledTimes(1);
  });

  it("「確定保存」クリックで controller.finalize を呼ぶ", () => {
    openDoc();
    render(<App />);
    fireEvent.click(screen.getByText("確定保存"));
    expect(controller.finalize).toHaveBeenCalledTimes(1);
  });
});

describe("App — 押印フロー", () => {
  it("テンプレート選択後にページクリックで addStamp を呼ぶ", () => {
    openDoc(1);
    render(<App />);
    act(() => {
      fireEvent.click(screen.getByTestId("set-template"));
    });
    act(() => {
      fireEvent.click(screen.getByTestId("pdf-page-0"));
    });
    expect(controller.addStamp).toHaveBeenCalledTimes(1);
    const stamp = controller.addStamp.mock.calls[0][0];
    expect(stamp.status).toBe("pending");
    expect(stamp.page).toBe(0);
  });
});
