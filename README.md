# 🏗️ CivilPDF Editor

建設・土木業向け高機能 PDF エディター（電子印鑑・OCR・大判図面対応）のデスクトップアプリ。
CivilPDF-DX プラットフォーム（管理コンソール）の配信ページから配布される **PDF Editor Client** 本体です。

> 🔵 本リポジトリは [CivilPDF-DX](../CivilPDF-DX) の **Scope B**（Issue #62）。コンソールとは独立した製品リポジトリです。

---

## 🧩 技術スタック

| 領域       | 採用                                                                  |
| ---------- | --------------------------------------------------------------------- |
| シェル     | **Tauri v2**（Rust バックエンド + システム WebView）                  |
| UI         | React 18 + TypeScript + Vite 5                                        |
| PDF 描画   | pdf.js (pdfjs-dist)                                                   |
| PDF 編集   | pdf-lib（印影フラット化・保存）                                       |
| ネイティブ | `@tauri-apps/plugin-dialog`（ファイル選択）/ `plugin-fs`（入出力）    |
| 配布       | Tauri bundler → `.exe`(NSIS) / `.msi` / `.dmg` / `.deb` / `.AppImage` |
| テスト     | Vitest（jsdom）                                                       |

> ℹ️ 旧 M1 は Electron で足場を作成しましたが、**PR #3 で Tauri v2 へ移行済み**（バンドルサイズ・Rust エコシステム）。現行は Tauri が単一の真実です。

---

## 🗺️ マイルストーン

| #      | 内容                                           | 状態                                                                       |
| ------ | ---------------------------------------------- | -------------------------------------------------------------------------- |
| **M1** | 足場 + PDF 表示 + ビルド配管 + CI              | ✅ 完了                                                                    |
| **M2** | 電子印鑑（PDF へスタンプ配置・保存・pdf-lib）  | ✅ 完了                                                                    |
| M3     | OCR（Tesseract.js WASM・日本語縦書き対応）     | ⏳ 設計済（[docs/design](docs/design/m3-m4-ocr-largeformat.md)・Issue #8） |
| M4     | 大判図面最適化（A0/A1 タイル描画・メモリ削減） | ⏳ 設計済（Issue #9 / #10）                                                |

---

## 🚀 開発

```bash
npm install
npm run dev          # フロント開発サーバ（Vite・port 1420）
npm run tauri dev    # Tauri 開発起動（ネイティブウィンドウ + HMR）
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest
npm run build        # フロントビルド（tsc -b && vite build → dist/）
```

> Rust ツールチェーン（stable）と各 OS の Tauri 前提ライブラリが必要です。
> Linux: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`。

---

## 📦 パッケージング / リリース

ローカルビルド:

```bash
npm run tauri build                              # 現在の OS 向けインストーラを生成
npm run tauri build -- --bundles deb appimage    # Linux 個別指定の例
```

成果物は `src-tauri/target/release/bundle/` 配下に出力されます
（`nsis/*.exe`, `msi/*.msi`, `dmg/*.dmg`, `deb/*.deb`, `appimage/*.AppImage`）。

CI リリース:

`v*` タグを push すると [`.github/workflows/release.yml`](.github/workflows/release.yml)
が **公式 `tauri-apps/tauri-action`** で Windows / macOS / Linux のインストーラを
生成し GitHub Release へ公開します。コンソール側は `APPS_RELEASE_BASE_URL` を
この Release アセットへ向けることで配信ページからダウンロード可能になります。

> ⚠️ 現状は **未署名ベータ**。Windows コードサイニング / Apple Developer ID + 公証は未設定で、
> 初回起動時に SmartScreen / Gatekeeper 警告が出ます。本番配布前に署名・公証を設定すること
> （CI に署名シークレットを追加）。

### 🏢 社内 IT 運用（Windows MSI 標準）

社内配布は **MSI を標準**とし、4 点標準（MSI 作成 / 署名 / サイレント対応 / アンインストール・検出条件）で管理します。
詳細・`msiexec` コマンド・Intune/SCCM 検出規則・自己署名証明書手順は
[docs/enterprise-deployment.md](docs/enterprise-deployment.md) を参照。

| 項目           | 値                                                                               |
| -------------- | -------------------------------------------------------------------------------- |
| サイレント導入 | `msiexec /i CivilPDF-Editor_<ver>_x64_en-US.msi /qn /norestart`                  |
| サイレント削除 | `msiexec /x {ProductCode} /qn`                                                   |
| 署名           | 自己署名 PFX（社内向け・証明書をクライアント信頼ストアへ配布）／今後 CI 署名対応 |
| 外部前提       | WebView2 ランタイム（Windows 11 は同梱、Windows 10 は要導入）                    |

---

## 🔐 セキュリティ

- **Tauri capabilities** による最小権限制御（[src-tauri/capabilities/default.json](src-tauri/capabilities/default.json)）
  - `fs:allow-read-file` / `fs:allow-write-file` は `$DOCUMENT`/`$DOWNLOAD`/`$DESKTOP`/`$TEMP` 配下に限定（Issue #4・PR #5）
  - ファイル選択は `dialog` プラグイン経由、入出力は `fs` プラグイン経由
- レンダラーは Rust バックエンドと capability で分離。任意パス・任意コマンド実行は不可
- CSP を [tauri.conf.json](src-tauri/tauri.conf.json) の `app.security.csp` で設定（`wasm-unsafe-eval` は OCR(WASM) 用）

> ⚠️ コードサイニング（Windows 証明書 / Apple Developer ID + notarization）は未設定。
> 本番配布前に署名・公証を設定すること（CI に署名シークレットを追加）。
