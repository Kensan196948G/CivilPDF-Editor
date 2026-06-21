import { vi, describe, it, expect, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";

// ── hoisted vi.mock calls ──────────────────────────────────────────────────
// pdfjs-dist uses ?worker at module eval time — mock the whole lib/pdf module
vi.mock("./lib/pdf", () => ({
  loadPdf: vi.fn().mockResolvedValue({
    numPages: 2,
    getPage: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock("./lib/embed", () => ({
  embedStampsIntoPdf: vi
    .fn()
    .mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
  dataUrlToBytes: vi.fn().mockReturnValue(new Uint8Array()),
}));

// PageView uses canvas + pdfjs render — replace with a simple div
vi.mock("./components/PageView", () => ({
  DEFAULT_SCALE: 1.2,
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
      onClick={() =>
        onSetTemplate({
          src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==",
          ratio: 1,
        })
      }
    >
      Set Template
    </button>
  ),
}));

// ── import App after mocks are in place ───────────────────────────────────
import { App } from "./App";

// Minimal %PDF bytes for IPC mock
const MOCK_PDF = [0x25, 0x50, 0x44, 0x46];

// ── tests ──────────────────────────────────────────────────────────────────
describe("App — 初期状態", () => {
  it("未選択時: 開くボタンあり、保存ボタン非表示、プレースホルダー表示", () => {
    render(<App />);
    expect(screen.getByText("PDF を開く")).toBeInTheDocument();
    expect(screen.queryByText(/押印して保存（/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/PDF を開いて電子印鑑を押印します/),
    ).toBeInTheDocument();
  });
});

describe("App — handleOpen IPC フロー", () => {
  afterEach(() => {
    clearMocks();
    vi.clearAllMocks();
  });

  it("ダイアログキャンセル (null) → ページ情報表示なし", async () => {
    mockIPC((cmd) => {
      if (cmd === "plugin:dialog|open") return null;
    });
    render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByText("PDF を開く"));
    });
    expect(screen.queryByText(/全.*ページ/)).not.toBeInTheDocument();
  });

  it("PDF 選択成功 → ファイル名・全2ページ表示、保存ボタン出現", async () => {
    mockIPC((cmd) => {
      if (cmd === "plugin:dialog|open") return "/home/user/test.pdf";
      if (cmd === "plugin:fs|read_file") return MOCK_PDF;
    });
    render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByText("PDF を開く"));
    });
    await waitFor(() => screen.getByText(/全 2 ページ/));
    expect(screen.getByText(/test\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/押印して保存/)).toBeInTheDocument();
  });

  it("PDF 読込後: 印鑑0個のとき保存ボタンは disabled", async () => {
    mockIPC((cmd) => {
      if (cmd === "plugin:dialog|open") return "/home/user/sample.pdf";
      if (cmd === "plugin:fs|read_file") return MOCK_PDF;
    });
    render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByText("PDF を開く"));
    });
    await waitFor(() => screen.getByText(/押印して保存/));
    expect(screen.getByText(/押印して保存/)).toBeDisabled();
  });
});

describe("App — handleSave IPC フロー", () => {
  afterEach(() => {
    clearMocks();
    vi.clearAllMocks();
  });

  it("印鑑1個配置後に保存 → writeFile が1回呼ばれる", async () => {
    const writeFileCalled = vi.fn();
    mockIPC((cmd) => {
      if (cmd === "plugin:dialog|open") return "/home/user/test.pdf";
      if (cmd === "plugin:fs|read_file") return MOCK_PDF;
      if (cmd === "plugin:dialog|save") return "/home/user/test-stamped.pdf";
      if (cmd === "plugin:fs|write_file") {
        writeFileCalled();
        return null;
      }
    });

    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<App />);

    // 1. PDF を開く
    await act(async () => {
      fireEvent.click(screen.getByText("PDF を開く"));
    });
    await waitFor(() => screen.getByText(/全 2 ページ/));

    // 2. テンプレート設定
    await act(async () => {
      fireEvent.click(screen.getByTestId("set-template"));
    });

    // 3. ページに印鑑を配置 (placing=true のときにクリックで onPlace 呼ばれる)
    await act(async () => {
      fireEvent.click(screen.getByTestId("pdf-page-0"));
    });

    // 4. 保存ボタンが有効になるまで待機
    await waitFor(() => {
      expect(screen.getByText(/押印して保存（1）/)).not.toBeDisabled();
    });

    // 5. 保存実行
    await act(async () => {
      fireEvent.click(screen.getByText(/押印して保存（1）/));
    });

    await waitFor(() => {
      expect(writeFileCalled).toHaveBeenCalledTimes(1);
    });

    alertSpy.mockRestore();
  });
});
