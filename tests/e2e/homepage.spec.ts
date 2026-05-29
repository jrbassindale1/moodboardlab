import { expect, test } from '@playwright/test';

test('homepage renders and saves a screenshot', async ({ page }, testInfo) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Moodboard Lab/i);
  await expect(
    page.getByRole('heading', { name: /select real materials/i })
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('homepage.png'),
    fullPage: true,
  });
});
