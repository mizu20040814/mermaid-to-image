import { test, expect } from '@playwright/test';

test('画面の骨格が表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Mermaid to Image');
  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#preview')).toBeVisible();
  await expect(page.getByRole('button', { name: 'PNG をダウンロード' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'SVG をダウンロード' })).toBeVisible();
});
