import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('画面の骨格が表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Mermaid to Image');
  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#preview')).toBeVisible();
  await expect(page.getByRole('button', { name: 'PNG をダウンロード' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'SVG をダウンロード' })).toBeVisible();
});

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
  await expect(page.locator('#preview svg')).toBeVisible();
  await expect(page.locator('#download-svg')).toBeEnabled();
  await page.locator('#editor').fill('   \n');
  await expect(page.locator('#preview svg')).toHaveCount(0);
  await expect(page.locator('#error')).toBeEmpty();
  await expect(page.locator('#download-svg')).toBeDisabled();
});

test('遅い描画が後から終わっても最新の入力の結果が残る', async ({ page }) => {
  // 未ロードの図種（sequenceDiagram）のチャンク取得を遅らせ、1回目の描画を確実に遅くする
  await page.route('**/assets/sequenceDiagram-*.js', async (route) => {
    await new Promise((r) => setTimeout(r, 2000));
    await route.continue();
  });
  await page.goto('/');
  await expect(page.locator('#preview svg')).toBeVisible();
  await page.locator('#editor').fill('sequenceDiagram\n  A->>B: こんにちは');
  // デバウンス (300ms) を越えて 1 回目の描画を開始させる
  await page.waitForTimeout(600);
  // 2回目: 空入力は描画を待たず即座に反映される。1回目より先に結果が出る
  await page.locator('#editor').fill('');
  await expect(page.locator('#preview svg')).toHaveCount(0);
  // 遅れて終わる 1 回目の結果が上書きしないことを確認
  await page.waitForTimeout(3500);
  await expect(page.locator('#preview svg')).toHaveCount(0);
  await expect(page.locator('#error')).toBeEmpty();
  await expect(page.locator('#download-png')).toBeDisabled();
});

test('HTML ラベルを使わず、エラー後も body に余計な SVG を残さない', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview svg')).toBeVisible();
  expect(await page.locator('#preview foreignObject').count()).toBe(0);
  await page.locator('#editor').fill('flowchart LR\n  A -->');
  await expect(page.locator('#error')).not.toBeEmpty();
  expect(await page.locator('body > svg, body > div[id^="d"]').count()).toBe(0);
});

test('SVG をダウンロードできる', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#download-svg')).toBeEnabled();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#download-svg').click()]);
  expect(dl.suggestedFilename()).toBe('diagram.svg');
  const text = (await readFile(await dl.path())).toString('utf8');
  expect(text).toContain('<svg');
  expect(text).toContain('開始');
});

test('入力直後にダウンロードしても最新の図が書き出される（SVG）', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#download-svg')).toBeEnabled();
  await page.locator('#editor').fill('flowchart LR\n  X[新しい] --> Y');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#download-svg').click()]);
  const text = (await readFile(await dl.path())).toString('utf8');
  expect(text).toContain('新しい');
  expect(text).not.toContain('開始');
});

test('描画中に入力し、古い描画が先に終わっても最新の図が書き出される', async ({ page }) => {
  // sequenceDiagram のチャンクを手動で解放するまで止め、1 回目の描画を描画中のまま保つ
  let release!: () => void;
  const released = new Promise<void>((r) => (release = r));
  await page.route('**/assets/sequenceDiagram-*.js', async (route) => {
    await released;
    await route.continue();
  });
  await page.goto('/');
  await expect(page.locator('#download-svg')).toBeEnabled();
  // 以降のデバウンスタイマーは clock を進めない限り発火しない
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 10_000);
  await page.locator('#editor').fill('sequenceDiagram\n  A->>B: 古い');
  await page.clock.runFor(300);
  // 1 回目の描画中に書き換える（このデバウンスはまだ発火させない）
  await page.locator('#editor').fill('flowchart LR\n  X[新しい] --> Y');
  // 1 回目の描画を終わらせる
  release();
  await page.waitForTimeout(1000);
  // 時計を戻してすぐクリックする（2 回目のデバウンスが発火するより先）
  await page.clock.resume();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#download-svg').click()]);
  const text = (await readFile(await dl.path())).toString('utf8');
  expect(text).toContain('新しい');
  expect(text).not.toContain('古い');
});

test('PNG をダウンロードできる（日本語の図・白背景で 2 倍）', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#download-png')).toBeEnabled();
  const vb = await page.locator('#preview svg').evaluate((el) => {
    const b = (el as SVGSVGElement).viewBox.baseVal;
    return { w: b.width, h: b.height };
  });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#download-png').click()]);
  expect(dl.suggestedFilename()).toBe('diagram.png');
  const buf = await readFile(await dl.path());
  expect(buf.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(buf.readUInt32BE(16)).toBe(Math.round(vb.w * 2)); // IHDR の幅
  expect(buf.readUInt32BE(20)).toBe(Math.round(vb.h * 2)); // IHDR の高さ
  const pixel = await page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('load'));
      img.src = 'data:image/png;base64,' + b64;
    });
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data);
  }, buf.toString('base64'));
  expect(pixel).toEqual([255, 255, 255, 255]);
});
