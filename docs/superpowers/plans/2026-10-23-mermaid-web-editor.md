# Mermaid Web エディタ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ブラウザで Mermaid を書くとプレビューされ、PNG / SVG でダウンロードできる静的 Web アプリを作る。

**Architecture:** Vite + TypeScript の素の DOM アプリ。描画は `src/render.ts` が `mermaid` で SVG 文字列を作り、書き出しは `src/export.ts` が SVG を整形して canvas で PNG にする。`src/main.ts` は DOM の配線だけを持つ。

**Tech Stack:** TypeScript, Vite, mermaid, Vitest（jsdom）, Playwright（@playwright/test）

**Spec:** `docs/superpowers/specs/2026-10-23-mermaid-web-editor-design.md`

## Global Constraints

- サーバー不要の静的アプリ。`npm run build` の成果物（`dist/`）だけで動くこと。
- フレームワークは使わない（React 等を入れない）。
- 再描画は入力停止から 300ms 後。
- PNG は白背景・倍率 2。長辺が 8192px を超えるなら 8192px に収まるよう倍率を下げる。
- ファイル名は `diagram.png` / `diagram.svg`。
- 画面の文言は日本語。ボタンは「PNG をダウンロード」「SVG をダウンロード」。
- 768px 未満では入力欄とプレビューを縦に並べる。
- E2E は Playwright。`/opt/pw-browsers/chromium` が存在すればそれを `executablePath` に使い、`playwright install` は実行しない。

## Review Focus

1. **foreignObject による canvas 汚染**: mermaid の既定（HTML ラベル）だと SVG を canvas に描いた時点で汚染され、`toBlob` が SecurityError になり PNG が出ない。→ `htmlLabels: false` で初期化し、Task 3 の E2E で PNG のシグネチャを検証する。
2. **日本語ラベル**: 日本語を含む図でも PNG / SVG が出ること。→ Task 3 の E2E は日本語サンプルで書き出す。
3. **描画の追い越し**: 重い描画が後から完了して新しい結果を上書きする。→ Task 2 で連番による破棄を入れ、「エラー入力→正しい入力を素早く」の E2E で最終状態を検証する。
4. **空入力**: 全消去で例外やエラー表示が出る。→ Task 2 の E2E で空入力時にプレビュー消去・エラーなし・ボタン無効を検証する。
5. **巨大な図**: canvas の上限を超えて PNG が真っ白・失敗になる。→ Task 3 の `pngScale` 単体テストで上限 8192px を検証する。

---

### Task 1: Vite + TypeScript の土台とテスト環境

**Files:**
- Delete: `puppeteer-config.json`
- Modify: `package.json`（`@mermaid-js/mermaid-cli` と `mmdc` スクリプトを削除、下記スクリプトを追加）
- Modify: `.gitignore`（`dist/`, `test-results/`, `playwright-report/` を追加）
- Create: `index.html`, `src/main.ts`, `src/style.css`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`
- Move: `examples/sample.mmd` はそのまま残す（Task 2 の初期値の元）
- Test: `tests/e2e/app.spec.ts`

**Interfaces:**
- Produces: `index.html` に次の要素 ID を持つ DOM。後続タスクはこの ID で要素を取る。
  - `#editor`（textarea）, `#preview`（div）, `#error`（div, `role="alert"`）, `#download-png`（button）, `#download-svg`（button）
- Produces: npm スクリプト `dev`（vite）, `build`（`tsc --noEmit && vite build`）, `preview`（vite preview）, `test`（vitest run）, `test:e2e`（playwright test）
- Produces: `playwright.config.ts` は `webServer` で `npm run build && npm run preview -- --port 4173` を起動し、`baseURL: http://localhost:4173`

- [ ] **Step 1: 依存を入れ替える**

Run: `npm uninstall @mermaid-js/mermaid-cli && npm install mermaid && npm install -D typescript vite vitest jsdom @playwright/test` を実行し、`puppeteer-config.json` を削除する。
Expected: `package.json` の dependencies が `mermaid` のみになる。

- [ ] **Step 2: 失敗する E2E を書く**

```ts
// tests/e2e/app.spec.ts
test('画面の骨格が表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Mermaid to Image');
  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#preview')).toBeVisible();
  await expect(page.getByRole('button', { name: 'PNG をダウンロード' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'SVG をダウンロード' })).toBeVisible();
});
```

- [ ] **Step 3: 失敗を確認する**

Run: `npm run test:e2e`
Expected: FAIL（`index.html` がないためビルド失敗、またはタイトル不一致）

- [ ] **Step 4: `index.html`・`src/main.ts`（空でよい）・`src/style.css`・設定ファイルを作る**

`<title>Mermaid to Image</title>`。2 カラムのグリッドで、`@media (max-width: 767px)` で 1 カラムにする。`vite.config.ts` に Vitest 用の `test: { environment: 'jsdom', include: ['tests/unit/**/*.test.ts'] }` を書く。

- [ ] **Step 5: 通ることを確認する**

Run: `npm run test:e2e && npm run build`
Expected: 1 passed、ビルド成功

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + TypeScript web app"
```

---

### Task 2: プレビュー描画とエラー表示

**Files:**
- Create: `src/render.ts`
- Modify: `src/main.ts`
- Test: `tests/e2e/app.spec.ts`

**Interfaces:**
- Consumes: Task 1 の要素 ID
- Produces: `src/render.ts`
  - `type RenderResult = { ok: true; svg: string } | { ok: false; message: string }`
  - `function initMermaid(): void` — `mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', htmlLabels: false, flowchart: { htmlLabels: false } })`
  - `async function renderDiagram(code: string): Promise<RenderResult>` — 先に `mermaid.parse(code)` で検証し（失敗時に mermaid が body にエラー SVG を残さないため）、通れば `mermaid.render(一意な id, code)`。例外は `{ ok: false, message }` に変換する。
- Produces: `src/main.ts` が保持する「最後に成功した SVG 文字列」`currentSvg: string | null`（Task 3 が書き出しに使う。エラー中・空入力中は `null`）

- [ ] **Step 1: 失敗する E2E を書く**

```ts
test('初期サンプルが描画される', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview svg')).toBeVisible();
  await expect(page.locator('#preview')).toContainText('開始');
  await expect(page.locator('#download-png')).toBeEnabled();
});

test('構文エラーでメッセージを出し、前の図を残してボタンを無効にする', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview svg')).toBeVisible();
  await page.locator('#editor').fill('flowchart LR\n  A -->');
  await expect(page.locator('#error')).not.toBeEmpty();
  await expect(page.locator('#preview svg')).toBeVisible();
  await expect(page.locator('#download-png')).toBeDisabled();
  await expect(page.locator('#download-svg')).toBeDisabled();
});

test('空入力ではプレビューを消し、エラーを出さない', async ({ page }) => {
  await page.goto('/');
  await page.locator('#editor').fill('   \n');
  await expect(page.locator('#preview svg')).toHaveCount(0);
  await expect(page.locator('#error')).toBeEmpty();
  await expect(page.locator('#download-svg')).toBeDisabled();
});

test('素早く書き換えても最後の入力の結果が残る', async ({ page }) => {
  await page.goto('/');
  await page.locator('#editor').fill('flowchart LR\n  A -->');
  await page.locator('#editor').fill('flowchart LR\n  X[最後] --> Y');
  await expect(page.locator('#preview')).toContainText('最後');
  await expect(page.locator('#error')).toBeEmpty();
  await expect(page.locator('#download-png')).toBeEnabled();
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test:e2e`
Expected: 新しい 4 件が FAIL

- [ ] **Step 3: `src/render.ts` を実装し、`src/main.ts` で配線する**

- textarea の初期値は `examples/sample.mmd` の内容（Vite の `?raw` import で読む）。起動時に即 1 回描画する。
- `input` イベントは 300ms のデバウンス。
- 描画ごとに連番を振り、完了時に最新の連番でなければ結果を捨てる。
- 成功: `#preview.innerHTML = svg`、`#error` を空、`currentSvg = svg`、ボタン有効。失敗: `#error` にメッセージ、プレビューは触らない、`currentSvg = null`、ボタン無効。空入力: プレビューとエラーを空、`currentSvg = null`、ボタン無効。

- [ ] **Step 4: 通ることを確認する**

Run: `npm run test:e2e`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: live mermaid preview with error handling"
```

---

### Task 3: PNG / SVG のダウンロード

**Files:**
- Create: `src/export.ts`
- Modify: `src/main.ts`, `README.md`（新規作成）
- Test: `tests/unit/export.test.ts`, `tests/e2e/app.spec.ts`

**Interfaces:**
- Consumes: Task 2 の `currentSvg`
- Produces: `src/export.ts`
  - `function prepareSvgForExport(svg: string): { svg: string; width: number; height: number }` — `DOMParser` で読み、`viewBox` から幅と高さを取り、ルート `<svg>` に `width`/`height` 属性を数値で付け、`style` の `max-width` を除き、`xmlns` を保証して `XMLSerializer` で返す。
  - `function pngScale(width: number, height: number, desired = 2, maxSide = 8192): number` — `Math.min(desired, maxSide / Math.max(width, height))`
  - `async function svgToPngBlob(svg: string): Promise<Blob>` — `prepareSvgForExport` → data URL（`data:image/svg+xml;charset=utf-8,` + `encodeURIComponent`）を `Image` で読み、`pngScale` 倍の canvas に白で塗ってから描き、`canvas.toBlob(..., 'image/png')`。blob URL ではなく data URL を使う。
  - `function downloadBlob(blob: Blob, filename: string): void` — 一時 `<a download>` をクリックし、`URL.revokeObjectURL` する。

- [ ] **Step 1: 失敗する単体テストを書く**

```ts
// tests/unit/export.test.ts
const raw = '<svg id="d" viewBox="0 0 300 120" style="max-width: 300px;" width="100%"><text>開始</text></svg>';

test('viewBox から幅と高さを付け、max-width を外す', () => {
  const r = prepareSvgForExport(raw);
  expect(r.width).toBe(300);
  expect(r.height).toBe(120);
  expect(r.svg).toContain('width="300"');
  expect(r.svg).toContain('height="120"');
  expect(r.svg).not.toContain('max-width');
  expect(r.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(r.svg).toContain('開始');
});

test('pngScale は通常 2 倍、長辺 8192px を超えるなら縮める', () => {
  expect(pngScale(300, 120)).toBe(2);
  expect(pngScale(8192, 100)).toBe(1);
  expect(pngScale(16384, 100)).toBe(0.5);
});
```

- [ ] **Step 2: 失敗する E2E を書く**

```ts
test('SVG をダウンロードできる', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#download-svg')).toBeEnabled();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#download-svg').click()]);
  expect(dl.suggestedFilename()).toBe('diagram.svg');
  const text = (await readFile(await dl.path())).toString('utf8');
  expect(text).toContain('<svg');
  expect(text).toContain('開始');
});

test('PNG をダウンロードできる（日本語の図・白背景で 2 倍）', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#download-png')).toBeEnabled();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#download-png').click()]);
  expect(dl.suggestedFilename()).toBe('diagram.png');
  const buf = await readFile(await dl.path());
  expect(buf.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(buf.readUInt32BE(16)).toBeGreaterThan(100); // IHDR の幅
});
```

- [ ] **Step 3: 失敗を確認する**

Run: `npm test && npm run test:e2e`
Expected: 単体 2 件と E2E 2 件が FAIL

- [ ] **Step 4: `src/export.ts` を実装し、ボタンに配線する**

ボタンは `currentSvg` が `null` なら何もしない。PNG 生成に失敗したら `#error` に「PNG の書き出しに失敗しました」と出す。

- [ ] **Step 5: 通ることを確認する**

Run: `npm test && npm run test:e2e && npm run build`
Expected: 単体 2 passed、E2E 7 passed、ビルド成功

- [ ] **Step 6: 目で確認する**

Playwright で PNG を書き出して開き、日本語ラベルが豆腐（□）になっていないこと、背景が白であることを見る。

- [ ] **Step 7: README を書く**

`npm install` / `npm run dev` / `npm test` / `npm run test:e2e` / `npm run build` の使い方と、ブラウザだけで動くことを書く。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: download diagram as PNG and SVG"
```
