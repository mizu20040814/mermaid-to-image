import { test, expect } from '@playwright/test';

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
