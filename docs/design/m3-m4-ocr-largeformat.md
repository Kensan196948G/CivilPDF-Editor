# 🏛️ M3 (OCR) / M4 (大判図面タイル化) アーキテクチャ設計

> 📌 本書は CivilPDF Editor の次マイルストーン **M3: OCR** と **M4: 大判図面最適化** の設計正本です。
> 🧱 実装前の設計フェーズ成果物であり、実装 PR はこの設計を参照して進めます。
> 🗓️ 作成: 2026-06-21 / 担当: 🏛️ Architect / 状態: Draft（CTO レビュー待ち）

---

## 📌 0. 前提・現状アーキテクチャの把握

### 0.1 技術スタック（実態）

| 領域          | 実態                                                          | 備考                                                                      |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 🐚 シェル     | **Tauri v2**（`src-tauri/`, `tauri.conf.json`, `Cargo.toml`） | ⚠️ README は "Electron 33" 表記。**実態は Tauri**。整合が必要（Issue 化） |
| 🦀 ネイティブ | Rust + `tauri-plugin-fs` / `tauri-plugin-dialog` のみ         | カスタム `#[tauri::command]` / sidecar は未定義                           |
| ⚛️ UI         | React 18 + Vite 5 + TypeScript                                |                                                                           |
| 📄 PDF 描画   | `pdfjs-dist@4.7`                                              | worker は Vite の `?worker` で同梱                                        |
| 💾 PDF 編集   | `pdf-lib@1.17`                                                | 印影 PNG を `drawImage` で焼き込み                                        |
| 🧪 テスト     | Vitest 2 + Testing Library + jsdom                            |                                                                           |

### 0.2 既存の座標モデル（M2 で確立、M3/M4 でも踏襲する基盤）

- 🧭 **pdfjs**: 左上原点。`PdfPage.tsx` は `page.getViewport({ scale: 1.2 })` 固定で **1 ページ = 単一 canvas** を `useEffect([page])` で 1 回描画。
- 🧭 **stamp モデル**: ページ相対の **分率 (0..1)** で位置・幅を保持（`Stamp.x/y/w`）。解像度非依存。
- 🧭 **pdf-lib 変換**: `toPdfRect()` が左上分率 → 左下原点 PDF 座標へ変換（`y = pageH - y*pageH - height`）。
- ✅ この「**分率 + 左上/左下変換**」は **OCR bbox にもそのまま再利用できる**。M3 は同じ規約に乗せる。

### 0.3 IPC / セキュリティ境界（CSP）

```
src-tauri/tauri.conf.json > app.security.csp:
  script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'   ← ✅ WASM 実行は既に許可済み
  worker-src 'self' blob:                              ← ✅ Web Worker 許可済み
  connect-src 'self' https://tauri.localhost http://localhost:*  ← ⚠️ 外部 HTTP なし(=クラウド OCR は要拡張)
  img-src 'self' data: blob:
```

> 💡 **結論的含意**: WASM/Worker で完結する **Tesseract.js は現 CSP のまま動く**。クラウド OCR は CSP の `connect-src` 拡張 + プライバシー懸念 + オフライン要件違反のため初手では不採用。

---

## 📌 1. M3: OCR 設計

### 1.1 要件の再確認（建設・土木ドメイン）

| 要件                                     | 重み | 理由                                                 |
| ---------------------------------------- | ---- | ---------------------------------------------------- |
| 🇯🇵 和文（明朝/ゴシック・縦書き含む）認識 | 高   | 図面表題欄・特記仕様書・出来形管理資料は日本語主体   |
| 📴 オフライン動作                        | 高   | 現場 PC・閉域 LAN・官公庁案件で外部送信不可が多い    |
| 🔒 データを外部送信しない                | 高   | 図面は機微情報。クラウド送信は受注者責任で敬遠される |
| 📦 バンドルサイズ現実性                  | 中   | デスクトップ配布。数十 MB は許容、数百 MB は要検討   |
| ⚖️ ライセンス（商用配布可）              | 高   | 製品配布のため GPL 強感染は回避したい                |
| 🧩 Tauri/WASM 相性                       | 中   | sidecar はクロスプラットフォーム同梱コスト大         |

### 1.2 エンジン比較

| 観点          | ① Tesseract.js (WASM/renderer)                      | ② Rust leptess/tesseract (sidecar/command)       | ③ クラウド (Azure/Google/Claude vision) |
| ------------- | --------------------------------------------------- | ------------------------------------------------ | --------------------------------------- |
| 🇯🇵 和文精度   | 中（`jpn`/`jpn_vert` traineddata。図面は中程度）    | 中（同一 Tesseract エンジン）                    | **高**（特に手書き・低品質）            |
| 📴 オフライン | ✅ 完全                                             | ✅ 完全                                          | ❌ 不可                                 |
| 🔒 データ秘匿 | ✅ ローカル完結                                     | ✅ ローカル完結                                  | ❌ 外部送信                             |
| 📦 配布コスト | ◯ traineddata を遅延 DL or 同梱（jpn ≈ 15-40MB）    | △ OS 別 libtesseract/leptonica 同梱が重い        | ◎ ランタイム不要                        |
| ⚖️ ライセンス | ✅ Apache-2.0（商用 OK）                            | ✅ Apache-2.0（同左、ただし leptonica 同梱注意） | 商用 OK だが従量課金                    |
| 🧩 統合容易性 | ✅ npm のみ。CSP 既対応。worker で UI 非ブロック    | △ 3 OS 分の sidecar ビルド/署名/同梱が必要       | ◯ HTTP だが CSP+鍵管理が要              |
| ⚡ 性能       | △ WASM。大ページは重い（タイル/ワーカー分割で緩和） | ◯ ネイティブで高速                               | ◎ サーバ側                              |
| 🛠️ 保守       | ✅ 単一コードベース                                 | ❌ ネイティブ依存の OS 差異が継続負債            | △ API 仕様変更・課金管理                |

### 1.3 ✅ 推奨案: **① Tesseract.js (WASM, Web Worker)** を一次採用

**選定理由（決定根拠）**

1. 🔒 **オフライン + データ秘匿** という建設ドメインの最重要要件を完全充足。
2. 🧩 現 **CSP が WASM/Worker を既に許可済み**で、追加のネイティブ同梱・署名・OS 差異負債が発生しない（②の最大の弱点を回避）。
3. ⚖️ **Apache-2.0** で商用配布に安全。
4. 📦 traineddata（`jpn`/`jpn_vert`/`eng`）は **アプリリソースに同梱**しオフライン保証（後述 1.6）。
5. 🧱 既存の **分率座標モデルと自然に接続**でき、M4 のタイル描画とも Worker で協調できる。

> 🚦 **将来の拡張点**: 精度が現場で不足する場合に限り、**②(Rust sidecar)** を「高精度モード」としてオプトイン追加する余地を残す（撤退条件は §3）。クラウド③は「明示的に外部送信を許可した案件のみ」のオプトイン機能として、CSP/鍵/監査を伴う別マイルストーンに分離。

### 1.4 OCR データモデル

既存 `Stamp` と同じ「ページ相対分率」規約に統一する。

```ts
// src/renderer/src/lib/ocr/types.ts （新規・設計案）

/** 1 単語/トークンの認識結果。座標はページ相対分率(0..1)・左上原点。 */
export interface OcrWord {
  text: string;
  // bbox はページ相対分率。Stamp と同じ規約 → PDF 埋め込みで toPdfRect 系を再利用
  x: number; // left   (0..1)
  y: number; // top    (0..1)
  w: number; // width  (0..1)
  h: number; // height (0..1)
  confidence: number; // 0..100 (tesseract 由来)
}

export interface OcrLine {
  words: OcrWord[];
  text: string;
}

export interface OcrPageResult {
  page: number; // 0-based
  lines: OcrLine[];
  words: OcrWord[]; // flatten（検索・埋め込み用）
  lang: string; // "jpn+eng" など
  durationMs: number;
  renderScale: number; // OCR にかけた画像の scale（再現性のため記録）
}

export interface OcrDocumentResult {
  pages: OcrPageResult[];
  engine: "tesseract.js";
  engineVersion: string;
  createdAt: string; // ISO8601
}
```

> 🧭 **正規化**: tesseract は **ピクセル bbox** を返す。OCR にかけた canvas の (width,height) で割って **分率へ正規化**してから保存する。これにより scale を変えても座標が壊れない。

### 1.5 透明テキストレイヤー埋め込み（pdf-lib）

検索可能 PDF (searchable PDF) 化。**見た目を変えず**にテキストを重ねる。

```
OcrWord(分率, 左上原点)
  → toPdfRect 系で PDF 座標(左下原点)へ変換（既存 geometry.ts を一般化して再利用）
  → page.drawText(word.text, {
        x, y,
        size: 推定フォントサイズ(= h * pageH をベースに調整),
        font: 日本語埋め込みフォント,
        opacity: 0,                     // ★ 透明（描画はするがインク無し）
        // renderingMode: Invisible が理想（下記 ⚠️ 参照）
     })
```

⚠️ **pdf-lib の制約と対策**

| 制約                            | 内容                                                     | 対策                                                                                                                                                                                |
| ------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🅰️ 標準フォントに日本語なし     | pdf-lib の StandardFonts は Latin のみ                   | `@pdf-lib/fontkit` を登録し **日本語サブセットフォント (TTF/OTF)** を埋め込む。例: Noto Sans/Serif JP のサブセット。CJK 全字形同梱はサイズ膨張するため **使用文字のみサブセット化** |
| 👻 真の Invisible (Tr 3) 非対応 | pdf-lib は text rendering mode 3 を直接 API 化していない | `opacity: 0` で実用上不可視に。完全な検索互換が要件なら **低レベル content stream に `3 Tr` を注入**（要 PoC・受入テストで検証）                                                    |
| 📐 bbox とグリフ幅の不一致      | OCR 1 単語の矩形に実テキスト幅を厳密合わせは困難         | 検索可能性が目的なので **位置近似で可**。`maxWidth`/`size` で過剰はみ出しのみ防ぐ                                                                                                   |
| 🈂️ 縦書き                       | 縦書き bbox とテキスト方向                               | 初版は横書き埋め込みのみ。縦書きは「認識して検索ヒット」を優先、配置は近似（§3 で明示）                                                                                             |

> 💡 **代替**: hOCR/ALTO を中間生成して `pdftotext` 互換にする案もあるが、依存追加になるため **pdf-lib 直書き**を一次採用。

### 1.6 traineddata（言語データ）配布戦略

| 項目          | 方針                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 📦 同梱言語   | `eng`, `jpn`, `jpn_vert`（縦書き）。`osd`(向き検出) も検討                                                                                   |
| 📁 配置       | Tauri リソース（`tauri.conf.json > bundle.resources`）に同梱。`@tauri-apps/api` の resource path 解決でローカル読込 → **完全オフライン保証** |
| 🌐 CSP        | ローカル読込のため `connect-src` 拡張不要（Tesseract.js の `langPath` をローカル resource に向ける）                                         |
| 📉 サイズ     | `*.traineddata.gz` の `fast` 系を採用しサイズ削減（精度とサイズのトレードオフは受入テストで判定）                                            |
| 🔄 遅延ロード | 初回 OCR 時のみメモリへロード。worker 内にキャッシュ                                                                                         |

### 1.7 UI / 処理フロー

```
[ユーザー操作]                 [renderer]                      [OCR Worker (WASM)]
 ┌───────────┐
 │ OCR ボタン │
 └─────┬─────┘
       │ ページ選択(全/現在/範囲)
       ▼
 ┌──────────────────┐   page.render(scale=OCR用) → ImageBitmap
 │ OcrPanel         │ ───────────────────────────────────────▶ recognize()
 │  進捗バー %      │ ◀── progress(0..1) ────────────────────  (worker.postMessage)
 │  キャンセル      │ ◀── OcrPageResult ─────────────────────  per page
 └────────┬─────────┘
          │ 全ページ完了
          ▼
 ┌──────────────────────────────┐
 │ 検索ボックス + ハイライト     │  ← OcrWord(分率) を overlay div で半透明ハイライト
 │ 「検索可能PDFとして保存」      │  ← embedTextLayer(originalBytes, ocrResult) → writeFile
 └──────────────────────────────┘
```

**処理上の要点**

- ⏱️ **UI 非ブロック**: OCR は **専用 Web Worker** で実行（Tesseract.js は worker 内で動かす）。メインスレッドは進捗受信のみ。
- 🖼️ **OCR 用レンダリング**: 表示用の `scale:1.2` ではなく、**OCR 精度に必要な解像度 (例 scale=2.0〜3.0 相当 / 目標 ~300DPI)** で別途 render → `ImageBitmap`/`OffscreenCanvas` を worker へ転送（`transferable`）。
- 🧹 **メモリ**: ページ単位で render→OCR→破棄。同時実行は 1〜2 ページに制限（M4 のメモリ管理と共通ポリシー）。
- 🚫 **キャンセル**: worker terminate + render task.cancel() で中断可能に。
- 🔁 **冪等性**: 既に OCR 済みの PDF への二重埋め込みを避けるためフラグ/メタを持つ。

### 1.8 モジュール構成（新規ファイル設計）

```
src/renderer/src/lib/ocr/
  types.ts          # OcrWord/OcrLine/OcrPageResult/OcrDocumentResult
  ocr-worker.ts      # Web Worker エントリ（Tesseract.js を内包）
  ocr-client.ts      # renderer 側 API（recognizePage/recognizeDoc, 進捗, cancel）
  render-for-ocr.ts  # pdfjs page → 高解像度 ImageBitmap
  embed-text.ts      # pdf-lib 透明テキスト埋め込み（geometry を再利用）
  normalize.ts       # px bbox → 分率正規化
src/renderer/src/components/
  OcrPanel.tsx       # ページ選択・進捗・キャンセル・保存・検索 UI
```

- ♻️ `geometry.ts` の `toPdfRect` を **`Stamp` 専用から汎用 rect 変換へ一般化**して `embed-text.ts` と共用（後方互換維持）。

---

## 📌 2. M4: 大判図面タイル化設計

### 2.1 問題

A0 (841×1189mm) / A1 図面を現行 `scale:1.2` 単一 canvas で描くと:

- 🧨 **巨大 canvas**: A0@150DPI ≈ 4967×7022px。GPU/ブラウザの **最大 canvas 寸法 (多くで 8192〜16384px)** に接近・超過し描画失敗 or 激重。
- 🐌 **初回表示が遅い**: フル解像度を 1 枚で焼くため数百 ms〜秒。
- 💥 **メモリ**: 1 canvas ≈ width×height×4byte。A0@150DPI ≈ 140MB/枚。多ページで枯渇。
- 🔍 **ズーム非対応**: 拡大時の精細化・縮小時の省メモリが効かない。

### 2.2 戦略（タイル + ズーム連動解像度 + 仮想化 + キャッシュ）

```
┌─────────────────────────────────────────────────────────┐
│ ビューポート(可視領域)                                    │
│   ┌──────┬──────┬──────┐   ← 各タイル = 独立 <canvas>     │
│   │ T0,0 │ T1,0 │ ...  │     pdfjs render(viewport の      │
│   ├──────┼──────┼──────┤     transform で当該タイル矩形)   │
│   │ T0,1 │ T1,1 │      │                                   │
│   └──────┴──────┴──────┘                                   │
│   可視タイルのみ render。画面外は破棄 or プレースホルダ    │
└─────────────────────────────────────────────────────────┘
```

| 技法                          | 設計                                                                                                                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🧩 **タイル分割**             | ページを固定サイズタイル（例 **512×512 CSS px**）のグリッドへ分割。各タイルは個別 `<canvas>`。pdfjs の `render({ viewport, transform })` でタイル矩形だけを描く（`viewport.clone({ ... })` + 平行移動 transform） |
| 🔍 **ズーム連動解像度切替**   | 表示倍率 `zoom` に応じ **離散 LOD（Level of Detail）** を採用（例 0.25/0.5/1/2/4）。`renderScale = zoom × devicePixelRatio` でタイルを描き、中間倍率は CSS スケールで補間しつつ最寄り LOD を非同期で差し替え      |
| 🪟 **ビューポート仮想化**     | スクロール/パン位置から **可視 + プリフェッチ 1 タイル分の縁** のみ DOM/canvas を生成。画面外は unmount（react-window 的手法を自前 or 軽量ライブラリ）                                                            |
| 🗂️ **レンダリングキャッシュ** | キー `=(pageIndex, lod, tileX, tileY)`。LRU で **総ピクセル予算**（後述）まで保持。再表示は再 render 回避                                                                                                         |
| 🧠 **メモリ上限管理**         | グローバル **ピクセルバジェット**（例: 上限 256–512MB 相当）。超過時は LRU で遠いタイル/低使用 LOD から破棄。OCR と予算を共有（同時多発を抑制）                                                                   |
| 🖥️ **devicePixelRatio 対応**  | HiDPI で `canvas.width = cssW × dpr`、`style.width = cssW px`。`ctx.scale(dpr,dpr)` ではなく **viewport scale に dpr を織り込む**（pdfjs の鮮明描画の定石）                                                       |
| ⏯️ **描画スケジューリング**   | 可視タイル優先のキュー。`requestIdleCallback`/`requestAnimationFrame` で 1 フレーム数タイルに制限し UI を止めない。パン中は低 LOD 即時 → 停止後に高 LOD 差替（プログレッシブ）                                    |

### 2.3 現 `PdfPage` からの移行設計（後方互換）

現状の **単一 canvas + 分率 overlay（stamp）** を壊さずに段階移行する。

| ステップ            | 内容                                                                                                                           | 後方互換                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 1️⃣ 抽象化           | `PdfPage` を **`PageView`（表示戦略を内包）** に置換。`SingleCanvasStrategy`（現行）と `TiledStrategy`（新）を内部で切替       | ✅ stamp overlay は `PageView` 外側に維持（分率なので描画戦略非依存） |
| 2️⃣ 閾値切替         | ページ実寸が閾値（例 **長辺 > 4000px @72DPI 相当 or A2 以上**）を超えたら自動で `TiledStrategy`、それ未満は従来 `SingleCanvas` | ✅ 通常 A4 は挙動不変                                                 |
| 3️⃣ overlay 座標統一 | stamp / OCR ハイライトは **ページ相対分率**のままズーム/タイルに追従（`transform: scale(zoom)` を親に集約）                    | ✅ `Stamp.x/y/w` 規約不変                                             |
| 4️⃣ ズーム UI        | ズームコントロール（fit/100%/+/-）を `App` に追加。`zoom` を `PageView` へ伝播                                                 | ✅ 既存ヘッダに追加するだけ                                           |

> 🧷 **重要な不変条件**: stamp と OCR bbox は **常に分率**。タイル化・ズームは「描画解像度」だけを変え、**論理座標(分率)は不変**に保つ。これが M2 資産を壊さない鍵。

### 2.4 パフォーマンス目標（受入基準の数値）

> 🖥️ 計測基準機: 一般的業務 PC（4 コア / 8–16GB RAM / 内蔵 GPU）、対象: A1 図面（テキスト+ベクタ主体）。

| 指標                            | 目標                                                          | 測定方法              |
| ------------------------------- | ------------------------------------------------------------- | --------------------- |
| 🚀 初回表示（fit 全体, 低 LOD） | **≤ 1.0s** で可視領域が表示                                   | open→first paint 計測 |
| 🖐️ パン（ドラッグ追従）         | **≥ 50fps** 体感（低 LOD 即時表示, 高 LOD は停止後）          | フレーム計測/体感     |
| 🔍 ズーム段階切替               | **≤ 300ms** で最寄り LOD タイル差替開始                       | zoom→tile swap 計測   |
| 🧠 メモリ上限                   | A1 単ページ操作で **常駐 ≤ 512MB**                            | プロセスメモリ監視    |
| 🧩 タイル描画単体               | 1 タイル(512²) render **≤ 30ms**                              | per-tile 計測         |
| 🪟 多ページ                     | 10 ページ文書スクロールでメモリ単調増加しない（LRU 解放確認） | 連続スクロール監視    |

### 2.5 モジュール構成（新規ファイル設計）

```
src/renderer/src/lib/viewer/
  tile-grid.ts        # ページ→タイルグリッド計算（LOD, タイルサイズ, dpr）
  tile-cache.ts       # LRU + ピクセルバジェット
  render-scheduler.ts # 可視優先キュー / rAF / cancel
  lod.ts              # zoom → 離散 LOD 解決
src/renderer/src/components/
  PageView.tsx        # 戦略切替（SingleCanvas / Tiled）
  TiledStrategy.tsx   # タイル描画ビュー
  SingleCanvasStrategy.tsx # 現行 PdfPage 相当（リファクタ移設）
  ZoomControls.tsx    # ズーム UI
```

---

## 📌 3. 🧨 Devil's Advocate — 弱点・リスク・代替案・撤退条件

### 3.1 M3 (OCR) への反証

| #   | 懸念                                                                    | 重大度 | 代替案 / 緩和                                                                        | 🚪 撤退条件                                                                                                   |
| --- | ----------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| O1  | 🇯🇵 **Tesseract の和文・図面精度が現場で不足**（細字・回転文字・かすれ） | 高     | 前処理（二値化/傾き補正/コントラスト）追加。`fast`→`best` traineddata 切替オプション | 業務サンプルで実用精度（例 文字正解率 < 目標）が前処理込みでも未達 → **②Rust sidecar 高精度モード**を追加検討 |
| O2  | 🐌 **WASM が大ページで重い**（A0/A1 を OCR すると数十秒）               | 中     | ページ単位 worker + タイル分割 OCR + 並列 worker（2）。バックグラウンド実行 + 進捗   | 体感が許容外で UX を損なう → ネイティブ sidecar へ部分移譲                                                    |
| O3  | 👻 **pdf-lib が真の Invisible テキスト(Tr 3)を直接出せない**            | 中     | `opacity:0`。必要なら content stream 低レベル注入の PoC                              | PoC で Adobe/Acrobat 検索互換が崩れる → hOCR 中間 + 別ツールへ切替                                            |
| O4  | 🅰️ **日本語フォント埋め込みでサイズ膨張**                               | 中     | **使用文字サブセット化**（fontkit）。全字形は同梱しない                              | サブセットでも肥大 → テキストレイヤーを「検索インデックス(別ファイル)」方式に変更                             |
| O5  | 🔁 **二重 OCR / 既存テキスト PDF への誤適用**                           | 低     | 既存テキスト有無を検出し警告。OCR 済みメタを付与                                     | —                                                                                                             |
| O6  | 📦 **traineddata 同梱でインストーラ肥大**（jpn+jpn_vert）               | 低     | `fast` 系採用。縦書きは任意 DL オプションに分離も可                                  | インストーラ上限超過 → 言語データを初回オンデマンド DL（要 connect-src 拡張・オフライン要件と要相談）         |

### 3.2 M4 (タイル化) への反証

| #   | 懸念                                                                  | 重大度 | 代替案 / 緩和                                                                     | 🚪 撤退条件                                                                                   |
| --- | --------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| T1  | 🧵 **pdfjs のタイル単位 render（transform）が想定通り高速に切れない** | 高     | `viewport` の `offsetX/offsetY` + `transform` で矩形描画する定石を PoC で先に検証 | PoC でタイル描画が単一 canvas より遅い/不安定 → **段階的解像度 (1 枚で LOD 切替)** 方式へ後退 |
| T2  | 🧩 **多数 canvas 要素で DOM/GPU 負荷増・コンテキストロスト**          | 中     | 仮想化で可視分のみ。`OffscreenCanvas`/単一大 canvas へタイルを blit する案も比較  | canvas 数起因の不安定 → 「ビューポート = 1 canvas、内容を再描画」方式へ切替                   |
| T3  | 🧠 **ピクセルバジェット管理が複雑化しバグ温床**                       | 中     | シンプルな LRU + 上限のみ。早期に単体テスト（tile-cache.ts）                      | 複雑化で不具合多発 → LOD を固定 2 段階に簡素化                                                |
| T4  | 📐 **stamp/OCR overlay の座標がズーム/タイルでずれる**                | 高     | overlay は分率 + 親 `transform: scale` に集約。ズーム時の座標テストを必須化       | ずれが解消不能 → overlay を canvas 直描画へ統合（react overlay 廃止）                         |
| T5  | 🖥️ **devicePixelRatio とブラウザ最大 canvas 寸法の組合せで描画失敗**  | 中     | dpr を LOD 上限でクランプ。タイルサイズ × dpr が上限を超えない設計                | 特定 GPU で破綻 → タイルサイズを動的縮小                                                      |
| T6  | 🏗️ **既存 `PdfPage` 全置換による M2 機能(stamp)のリグレッション**     | 高     | 戦略パターンで段階移行。A4 は従来パス維持。stamp の e2e/単体テスト整備後に切替    | リグレッション多発 → Tiled を feature flag で隔離し A4/標準は従来維持                         |

### 3.3 横断リスク

| #   | 懸念                                                                              | 緩和                                                                   |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| X1  | 🔀 OCR(WASM worker) と Tiled(render scheduler) が **同時に CPU/メモリを奪い合う** | **共通リソースバジェット**で同時実行を調停。OCR 中はタイル先読みを抑制 |
| X2  | 📚 **README が Electron 表記**で実態(Tauri)と乖離                                 | M3/M4 着手前に **README/技術スタックを Tauri v2 へ整合**（独立 Issue） |
| X3  | 🧪 現状 **e2e/描画系テストが薄い**ため大改修のリグレッション検知力不足            | 移行前に PdfPage/embed の単体・描画スナップショットを補強              |

---

## 📌 4. 実装順序の推奨（依存関係）

```
[Issue A] README/技術スタック整合 (Tauri v2 明記)   ← 独立・最初に小さく
        │
        ▼
[Issue B] M3 OCR コア (Tesseract.js worker + データモデル + UI)
        │  └─ 透明テキスト埋め込み(pdf-lib+fontkit) を内包 or 分離
        ▼
[Issue C] M4 大判タイル PoC + viewer 抽象化(PageView 戦略)
        │  └─ stamp/OCR overlay の分率追従を保証
        ▼
[Issue D] M4 タイル本実装 + ズーム UI + キャッシュ/バジェット + 性能受入
```

- 🔗 **B と C は独立着手可**（座標規約のみ共有）。ただし C の overlay 追従設計は B の OCR ハイライトと整合させること。
- 🧷 D は C(PoC + 抽象化) 完了が前提。

---

## 📌 5. 完了の定義（マイルストーン DoD 抜粋）

- ✅ M3: 日本語 PDF を OCR → 検索可能 PDF として保存 → 別ビューアで本文検索ヒット。UI 非ブロック・キャンセル可・オフライン動作。
- ✅ M4: A1 図面で §2.4 の性能目標を満たし、A4 は従来挙動を維持。stamp/OCR overlay がズーム/パンで座標一致。
- ✅ 共通: lint/typecheck/test/build/CI green。Critical/High レビュー指摘 0。README 整合済み。
