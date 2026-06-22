# Changelog

All notable changes to CivilPDF Editor are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.1] - 2026-06-22

### 🐛 Fixed — テキスト編集の日本語対応

- **テキスト編集モードで日本語が焼き込まれない不具合を修正** — 確定保存しても原文が白塗りされるだけで新しい日本語テキストが反映されなかった
  - 原因: `drawTextEdit` が ASCII 専用フォント (Helvetica) を使い、焼き込み前に非 ASCII 文字を全除去していた
  - **NotoSansJP** (SIL OFL 1.1) を同梱し、`@pdf-lib/fontkit` で **subset 埋め込み**（出力 PDF には使用グリフのみ＝数 KB 増）
  - CJK は単語区切りが無いため、`widthOfTextAtSize` で実幅を測りボックス幅に収まるようフォントサイズを自動縮小（fit-to-width）
  - 空テキスト（テキスト削除）時はフォントを埋め込まず、使用グリフ 0 の CFF サブセットによる例外を回避

### ✅ Verified — 他の注釈機能

- ハイライト・下線・取消線・手書きはベクター描画で言語非依存のため正常動作を確認
- 付箋 (note) は従来どおりアイコンのみ焼き込み（本文テキストは編集レイヤーに保持）

---

## [1.2.0] - 2026-06-22

### 🆕 Added — テキスト編集モード

- **テキスト編集** (`TextEditLayer` + `TextEditAnnot`) — 既存 PDF のテキストをクリックして内容を変更できる「テキスト編集モード」を追加
  - pdfjs `getTextContent()` でページ上のテキスト位置を自動検出し、薄青色のヒットゾーンを表示
  - テキストをクリックするとインライン編集ポップアップが開き、元テキストが自動入力された状態でそのまま編集可能
  - 確定するとホワイトアウト矩形（白塗り）で元テキストを消去し、新テキストをベクターで上書き描画（非破壊 → PDF 保存時に焼き込み）
  - Enter で確定 / Esc でキャンセル / Shift+Enter で改行入力
  - ⚠️ ASCII 文字のみ焼き込み可（Helvetica の制約）。日本語テキストの書き換えは次バージョンで対応予定

---

## [Unreleased]

### 🆕 Added — M7 機能拡張（v1.1.0 開発中・PR #23）

#### アプリ骨格
- 中央ドキュメントモデル `lib/document/`（`useReducer`・dirty 遷移を 1 箇所に集約・ページ index remap）
- ネイティブメニュー（`@tauri-apps/api/menu`）— ファイル/編集/表示・アクセラレータ・ref レジストリで stale closure 回避
- 保存基盤の刷新 — フルパス保持・上書き保存（`CmdOrCtrl+S`）/ 名前を付けて保存・ウィンドウタイトル dirty 表示・閉じる前ガード
- 印刷 — 印刷専用レンダリング（150DPI）+ `window.print()`（大判 PDF 対応・押印/注釈を焼き込んで WYSIWYG 出力）

#### 編集
- ページ操作 `lib/page-ops.ts` — 回転 / 削除 / 並べ替え / 空白挿入 / 別 PDF 挿入 / 結合 / 分割（`PageIndexMap` で注釈・印鑑を追従）
- 注釈マークアップ `lib/annotations/` — ハイライト / 下線 / 取消線 / 付箋 / フリーハンドのベクター焼き込み

#### 変換
- Word(.docx) 書き出し — `docx` + pdfjs テキスト抽出（行クラスタリング）/ OCR フォールバック・`Packer.toBlob`（webview 互換）
- 画像書き出し — PNG / JPEG（OffscreenCanvas）

#### 電子印鑑レビュー
- `Stamp` 型を後方互換拡張（作成者 / 日時 / status / コメント / 履歴）+ `normalizeStamp`
- レビュー UI（`ReviewPanel`）— 一覧・承認/却下/コメント・status フィルタ・集計・append-only 監査履歴
- 2 方式保存 — **非破壊レビュー保存**（PDF Info 辞書 JSON round-trip で再編集/承認可・DX 交換可能な `civilpdf.review/v1` 契約）と **確定保存**（フラット化・承認済みのみ焼き込みオプション）

#### 依存・テスト
- `docx ^9.7.1` 追加（本番依存の脆弱性 0 件）
- テスト 75 → 136（中央モデル / レビュー round-trip / ページ操作 / 注釈 / 変換の純粋関数を網羅）

### 🔜 引き続き予定
- コードサイニング（Windows EV証明書 / Apple Developer ID + 公証）
- 日本語テキスト完全埋め込み（@pdf-lib/fontkit + NotoSansJP TTF サブセット）
- 本文テキスト直接編集・レイアウト保持の高精度 Word 変換（後続フェーズ）
- 注釈の描画 UI（オーバーレイ）本実装・ページサムネイル D&D・手動 E2E 検証
- Playwright + Tauri v2 WebView による E2E シナリオテスト

---

## [1.0.0] — 2026-06-21

### 🆕 Added

#### M5: コンポーネント統合テスト (#17, PR #19)
- `ZoomControls.test.tsx` — パーセント表示・ボタン操作・disabled 制御 (9 tests)
- `OcrPanel.test.tsx` — idle→running→done フロー・キャンセル・保存 (6 tests)
- `PageView.test.tsx` — SingleCanvas/TiledCanvasLayer 選択・placing 制御・スタンプ (8 tests)
- `test-setup.ts` — jsdom `getContext` 警告をグローバル抑制するモック追加
- **合計テスト**: 75 tests / 14 suites

#### M4: 大判図面最適化 (#9, #10, PR #12, #15)
- `lib/viewer/types.ts` — `TileRect` / `TileGrid` 型・`TILE_SIZE=1024` / `LARGE_PAGE_THRESHOLD=3000` 定数
- `lib/viewer/tile-grid.ts` — 1024×1024 タイル分割アルゴリズム（エッジタイル整形対応）
- `lib/viewer/lod.ts` — LOD アンカー [0.5, 1.0, 1.5, 2.0, 3.0] へのスナップ関数
- `lib/viewer/tile-cache.ts` — Map 挿入順 LRU + 128 MiB ピクセルバジェット、ImageBitmap 管理
- `lib/viewer/render-scheduler.ts` — Semaphore (MAX_CONCURRENT=4) によるタイル並列レンダ律速
- `components/ZoomControls.tsx` — ±0.25 ステップ / リセット / 0.5–4.0 範囲のズーム UI
- `PageView.tsx` — `SingleCanvas`（≤3000px）/ `TiledCanvasLayer`（>3000px）ストラテジーパターン

#### M3: OCR テキスト認識 (#8, PR #14)
- `lib/ocr/types.ts` — `OcrWord` / `OcrLine` / `OcrPageResult` / `OcrProgress` 型定義
- `lib/ocr/normalize.ts` — ページ座標の正規化ヘルパー
- `lib/ocr/render-for-ocr.ts` — PDF ページ → OffscreenCanvas (scale×2) → Blob
- `lib/ocr/ocr-client.ts` — Tesseract.js v5 worker ラッパー（jpn/eng 両対応・進捗コールバック）
- `lib/ocr/embed-text.ts` — pdf-lib で不可視テキストレイヤー埋め込み（opacity: 0）
- `components/OcrPanel.tsx` — OCR UI（idle/running/done/cancelled/error の5フェーズ・進捗バー・キャンセル）

#### M2: 電子印鑑 (PR #3)
- スタンプ配置・移動・リサイズ・削除 UI
- テキストスタンプ（氏名・日付）と画像スタンプ生成
- pdf-lib によるスタンプ込み PDF 保存

#### M1: 基盤整備 (PR #1, #3)
- Tauri v2（Rust バックエンド + システム WebView）への移行（Electron から）
- React 18 + TypeScript + Vite 5 フロントエンド基盤
- pdfjs-dist v4 による PDF 描画
- Vitest + @testing-library/react テスト基盤
- GitHub Actions CI（lint/typecheck/test/build/cargo check）
- 社内 IT 向け MSI 標準化（署名・サイレントインストール・Intune/SCCM 対応）

### 🔒 Security

#### Tauri Capability 最小権限化 (#4, PR #5)
- `fs:allow-read-file` / `fs:allow-write-file` のパススコープを `**`（全ファイル）から
  `$DOCUMENT/**` / `$DOWNLOAD/**` / `$DESKTOP/**` / `$TEMP/**` に限定

### 🐛 Fixed

#### リリース配管修復 (#7, PR #11)
- `release.yml` が存在しない npm script を呼び出していたため CI が即失敗していた問題を修正
- 公式 `tauri-apps/tauri-action@v0` に置換し、Windows/macOS/Linux インストーラを自動生成

### 🔧 Changed

- Electron → **Tauri v2** 移行（バンドルサイズ削減・Rust エコシステム・OS ネイティブ WebView）
- ビルドツールチェーン: electron-vite → Vite 5 直接
- IPC 層: `window.api` → `@tauri-apps/plugin-dialog` / `plugin-fs`

### ⚠️ Known Limitations

- コードサイニング未設定（未署名ベータ）— Windows SmartScreen / macOS Gatekeeper 警告が出る
- 日本語テキスト PDF 埋め込みは ASCII 文字のみ（NotoSansJP は未統合）
- Playwright E2E テストは未実装

---

## [0.1.0] — 2026-06-20

初回タグ相当（Tauri v2 移行完了・基盤実装済み・CI 緑）

---

[Unreleased]: https://github.com/Kensan196948G/CivilPDF-Editor/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Kensan196948G/CivilPDF-Editor/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/Kensan196948G/CivilPDF-Editor/releases/tag/v0.1.0
