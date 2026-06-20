# 🏢 社内 IT 運用ガイド（Windows MSI 標準）

CivilPDF Editor を社内 IT（Intune / SCCM / GPO）で運用するための標準。
**4 点標準**: ①MSI で作る ②署名する ③サイレント対応 ④アンインストール・検出条件を決める。

---

## 📌 1. MSI で作る

- 配布の**標準は MSI**（`CivilPDF-Editor-<version>.msi`）。MSI が使えない端末向けに無人 EXE（NSIS `/S`）も提供。
- ビルド: `npm run package:win` → `dist-release/` に `.msi` と `.exe` を生成。
- 外部ランタイム前提は**なし**（Electron がランタイムを同梱）。.NET 等の事前導入は不要。

| 項目                | 値                                                  |
| ------------------- | --------------------------------------------------- |
| ProductName         | CivilPDF Editor                                     |
| appId               | `jp.civildx.editor`                                 |
| UpgradeCode（固定） | `DFFC9F41-030E-4556-91EC-67BD02119845`              |
| インストール単位    | per-machine（全ユーザー / 管理者権限）              |
| ProductCode         | バージョン毎に変化（検出は UpgradeCode/版数を使用） |

---

## 📌 2. 署名する（自己署名・社内向け）

1. 証明書生成（一度だけ）:
   ```powershell
   pwsh -File scripts/gen-selfsigned-cert.ps1 -Password "<pfx-pass>" -OutDir .\certs
   ```
2. CI 署名: `CSC_LINK`（PFX の base64 もしくはパス）と `CSC_KEY_PASSWORD` を Secret に設定。
   electron-builder が MSI/EXE/アプリを署名する。
3. **クライアント配布**: 生成した `civilpdf-codesign.cer` を GPO/Intune で
   「信頼されたルート証明機関」+「信頼された発行元」へ配布する。
   - これを行わないと SmartScreen / UAC 警告が出る（自己署名のため）。
   - インターネット配布する場合は OV/EV 証明書が必要（社内のみなら自己署名で可）。

---

## 📌 3. サイレント対応

### インストール（完全サイレント）

```bat
msiexec /i CivilPDF-Editor-2.4.1.msi /qn /norestart /l*v install.log
```

- `/qn` UI なし / `/norestart` 再起動抑制 / `/l*v` 詳細ログ。

### アップグレード

- UpgradeCode 固定のため、新版 MSI を `/qn` で適用すると旧版を自動置換。

### アンインストール（コマンドライン）

```bat
:: ProductCode 指定（推奨・確実）
msiexec /x {ProductCode} /qn /norestart

:: ファイル名指定でも可
msiexec /x CivilPDF-Editor-2.4.1.msi /qn /norestart
```

ProductCode は導入後にレジストリ（下記）または下記 PowerShell で取得:

```powershell
Get-CimInstance Win32_Product -Filter "Name='CivilPDF Editor'" | Select IdentifyingNumber, Version
```

---

## 📌 4. アンインストール・検出条件

### 検出（Intune / SCCM の検出規則に使用）

| 方法                           | 値                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| レジストリ（per-machine）      | `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{ProductCode}` の `DisplayVersion` ≥ 目標版 |
| UpgradeCode → ProductCode 解決 | `HKLM\SOFTWARE\Classes\Installer\UpgradeCodes\<packed-UpgradeCode>`                                   |
| ファイル版数                   | `C:\Program Files\CivilPDF Editor\CivilPDF Editor.exe` の FileVersion                                 |
| MSI ProductCode                | `Win32_Product` / `msiexec` ログ                                                                      |

> 💡 Intune Win32 アプリでは「MSI」検出（ProductCode + バージョン）が最も簡単。SCCM は DisplayVersion レジストリ検出が定番。

### 配布フロー（基盤）

```text
CivilPDF-Editor リポジトリ
  └ v* タグ push → GitHub Actions(release.yml) → 署名済 .msi/.exe/.dmg/.pkg を GitHub Release へ
       └ IT が MSI を取得（または CivilPDF-DX コンソール配信ページ: APPS_RELEASE_BASE_URL）
            └ Intune / SCCM / GPO で /qn 一括展開
```

---

## 📌 5. 既知の前提・制約

- 🔐 自己署名のため、証明書をクライアント信頼ストアへ配布しない限り警告が出る。
- 🧩 外部ランタイム前提なし（同梱）。「不足時に失敗」する事象は発生しない設計。
- 🖥️ macOS は `.pkg`（MDM/Jamf）/`.dmg`。Windows MSI とは別系統。
