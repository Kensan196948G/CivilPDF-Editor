# Changelog

All notable changes to CivilPDF Editor are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

- コードサイニング（Windows EV証明書 / Apple Developer ID + 公証）
- 日本語テキスト完全埋め込み（@pdf-lib/fontkit + NotoSansJP TTF サブセット）
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
