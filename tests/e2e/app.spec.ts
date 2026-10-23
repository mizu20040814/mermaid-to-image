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

test('HTML ラベルを使わず、エラー後も body に余計な SVG を残さない', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview svg')).toBeVisible();
  expect(await page.locator('#preview foreignObject').count()).toBe(0);
  await page.locator('#editor').fill('flowchart LR\n  A -->');
  await expect(page.locator('#error')).not.toBeEmpty();
  expect(await page.locator('body > svg, body > div[id^="d"]').count()).toBe(0);
});
