import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";

// ── vi.hoisted でモック関数を宣言（vi.mock ファクトリより前に評価される）

const { mockSave, mockWriteFile, mockRecognizePage, mockEmbedTextLayer } =
  vi.hoisted(() => ({
    mockSave: vi.fn().mockResolvedValue("/tmp/output.pdf"),
    mockWriteFile: vi.fn().mockResolvedValue(undefined),
    mockRecognizePage: vi.fn().mockResolvedValue({
      pageIndex: 0,
      words: [
        { text: "テスト", confidence: 0.95, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } },
        { text: "文字", confidence: 0.90, bbox: { x0: 12, y0: 0, x1: 22, y1: 10 } },
      ],
    }),
    mockEmbedTextLayer: vi
      .fn()
      .mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
  }));

// ── vi.mock ファクトリ（hoisted 関数を安全に参照可能）

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: mockSave }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeFile: mockWriteFile }));
vi.mock("../lib/ocr/ocr-client", () => ({ recognizePage: mockRecognizePage }));
vi.mock("../lib/ocr/embed-text", () => ({ embedTextLayer: mockEmbedTextLayer }));

// ── import はモック宣言の後
import { OcrPanel } from "./OcrPanel";

// ── テスト用ダミーデータ

const MOCK_PAGE = {
  getViewport: vi.fn().mockReturnValue({ width: 595, height: 842 }),
  render: vi.fn().mockReturnValue({ promise: Promise.resolve(), cancel: vi.fn() }),
  cleanup: vi.fn(),
};

const MOCK_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

// ─────────────────────────────────────────────────────────────

describe("OcrPanel — 初期状態 (idle)", () => {
  it("「認識開始」ボタンが表示される", () => {
    render(<OcrPanel pages={[MOCK_PAGE as never]} originalBytes={MOCK_BYTES} />);
    expect(screen.getByText("認識開始")).toBeInTheDocument();
    expect(screen.queryByText("キャンセル")).not.toBeInTheDocument();
  });

  it("ラベル「テキスト認識 (OCR)」が表示される", () => {
    render(<OcrPanel pages={[MOCK_PAGE as never]} originalBytes={MOCK_BYTES} />);
    expect(screen.getByText("テキスト認識 (OCR)")).toBeInTheDocument();
  });
});

describe("OcrPanel — OCR 実行フロー", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSave.mockResolvedValue("/tmp/output.pdf");
    mockWriteFile.mockResolvedValue(undefined);
    mockEmbedTextLayer.mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    mockRecognizePage.mockResolvedValue({
      pageIndex: 0,
      words: [
        { text: "テスト", confidence: 0.95, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } },
        { text: "文字", confidence: 0.90, bbox: { x0: 12, y0: 0, x1: 22, y1: 10 } },
      ],
    });
  });

  it("「認識開始」クリック → running フェーズ → キャンセルボタン表示", async () => {
    // 解決しない Promise: テスト期間中 running フェーズを維持する
    // afterEach の cleanup で unmount されるためリークしない
    mockRecognizePage.mockImplementationOnce(() => new Promise<never>(() => {}));

    render(<OcrPanel pages={[MOCK_PAGE as never]} originalBytes={MOCK_BYTES} />);

    await act(async () => {
      fireEvent.click(screen.getByText("認識開始"));
    });

    expect(screen.getByText("キャンセル")).toBeInTheDocument();
  });

  it("OCR 完了 → 語数と「検索可能 PDF として保存」ボタンが表示される", async () => {
    render(<OcrPanel pages={[MOCK_PAGE as never]} originalBytes={MOCK_BYTES} />);

    await act(async () => {
      fireEvent.click(screen.getByText("認識開始"));
    });

    await waitFor(() => {
      expect(screen.getByText(/完了/)).toBeInTheDocument();
    });

    expect(screen.getByText(/2 語認識/)).toBeInTheDocument();
    expect(screen.getByText("検索可能 PDF として保存")).toBeInTheDocument();
  });

  it("完了後「再実行」クリック → idle 状態に戻る", async () => {
    render(<OcrPanel pages={[MOCK_PAGE as never]} originalBytes={MOCK_BYTES} />);

    await act(async () => {
      fireEvent.click(screen.getByText("認識開始"));
    });

    await waitFor(() => expect(screen.getByText("再実行")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText("再実行"));
    });

    expect(screen.getByText("認識開始")).toBeInTheDocument();
  });

  it("完了後「検索可能 PDF として保存」クリック → writeFile が呼ばれる", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<OcrPanel pages={[MOCK_PAGE as never]} originalBytes={MOCK_BYTES} />);

    await act(async () => {
      fireEvent.click(screen.getByText("認識開始"));
    });

    await waitFor(() =>
      expect(screen.getByText("検索可能 PDF として保存")).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByText("検索可能 PDF として保存"));
    });

    await waitFor(() => expect(mockWriteFile).toHaveBeenCalledTimes(1));

    alertSpy.mockRestore();
  });
});
