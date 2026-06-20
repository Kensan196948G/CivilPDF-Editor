# 🏗️ CivilPDF Editor

建設・土木業向け高機能 PDF エディター（電子印鑑・OCR・大判図面対応）のデスクトップアプリ。
CivilPDF-DX プラットフォーム（管理コンソール）の配信ページから配布される **PDF Editor Client** 本体です。

> 🔵 本リポジトリは [CivilPDF-DX](../CivilPDF-DX) の **Scope B**（Issue #62）。コンソールとは独立した製品リポジトリです。

---

## 🧩 技術スタック

| 領域     | 採用                                                 |
| -------- | ---------------------------------------------------- |
| シェル   | Electron 33                                          |
| UI       | React 18 + TypeScript + Vite（electron-vite）        |
| PDF 描画 | pdf.js (pdfjs-dist)                                  |
| 配布     | electron-builder → `.exe` / `.msi` / `.dmg` / `.pkg` |
| テスト   | Vitest                                               |

---

## 🗺️ マイルストーン

| #      | 内容                                           | 状態          |
| ------ | ---------------------------------------------- | ------------- |
| **M1** | 足場 + PDF 表示 + ビルド配管 + CI              | ✅ 本コミット |
| M2     | 電子印鑑（PDF へスタンプ配置・保存・pdf-lib）  | ⏳            |
| M3     | OCR（tesseract.js・日本語縦書き対応）          | ⏳            |
| M4     | 大判図面最適化（A0/A1 タイル描画・メモリ削減） | ⏳            |

---

## 🚀 開発

```bash
npm install
npm run dev          # Electron 開発起動（HMR）
npm run lint         # ESLint
npm run typecheck    # tsc（main/preload/renderer）
npm test             # Vitest
npm run build        # electron-vite build（out/ へ）
```

## 📦 パッケージング

```bash
npm run package:win  # .exe (NSIS) + .msi
npm run package:mac  # .dmg + .pkg
```

成果物は `dist-release/` に出力されます。ファイル名は配信 API
（`CivilPDF-Editor-Setup-${version}.exe` 等）と一致します。

---

## 🔗 配信連携

`v*` タグを push すると `.github/workflows/release.yml` が Windows/macOS で
インストーラーを生成し GitHub Release へ公開します。コンソール側は
`APPS_RELEASE_BASE_URL` をこの Release アセットに向けることで配信ページから
ダウンロード可能になります。

### 🏢 社内 IT 運用（Windows MSI 標準）

社内配布は **MSI を標準**とし、4 点標準（MSI 作成 / 署名 / サイレント対応 / アンインストール・検出条件）で管理します。
詳細・`msiexec` コマンド・Intune/SCCM 検出規則・自己署名証明書手順は
[docs/enterprise-deployment.md](docs/enterprise-deployment.md) を参照。

| 項目                | 値                                                             |
| ------------------- | -------------------------------------------------------------- |
| UpgradeCode（固定） | `DFFC9F41-030E-4556-91EC-67BD02119845`                         |
| サイレント導入      | `msiexec /i CivilPDF-Editor-<ver>.msi /qn /norestart`          |
| サイレント削除      | `msiexec /x {ProductCode} /qn`                                 |
| 署名                | 自己署名 PFX（社内向け・証明書をクライアント信頼ストアへ配布） |
| 外部前提            | なし（Electron がランタイム同梱）                              |

---

## 🔐 セキュリティ

- `contextIsolation: true` / `nodeIntegration: false`（レンダラー隔離の主防御）
- `sandbox: false`（ESM preload のため。CJS preload 化で sandbox 復帰予定＝ハードニング項目）
- レンダラーは fs 直アクセス不可。ファイル入出力は IPC（`pdf:open`）経由で main が実施
- CSP を `index.html` に設定

> ⚠️ コードサイニング（Windows 証明書 / Apple Developer ID + notarization）は未設定。
> 本番配布前に署名・公証を設定すること（CI に署名シークレットを追加）。

### 依存脆弱性ステータス

- 🟢 **シップされる Electron アプリの runtime 脆弱性: 0**（electron 42 / electron-builder 26）
- 🟡 dev ツールチェーン（vite/vitest/esbuild 経由）に 6 件の advisory が残存。dev サーバ/テスト時のみで配布物には非該当。解消には vite/vitest メジャー更新（electron-vite の対応待ち）が必要 ＝ フォローアップ
