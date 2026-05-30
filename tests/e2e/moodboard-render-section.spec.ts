import { test, expect } from '@playwright/test';

// A tiny 1x1 grey PNG as base64 — served via page.route so it's an HTTP URL (not a data URI).
// The app strips data URIs from the render URL cache, so we must use a real-looking HTTP URL.
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const MOCK_RENDER_URL = 'http://127.0.0.1:3000/__test-moodboard-render.png';

const SAMPLE_BOARD = [
  {
    id: 'brick-red',
    name: 'Red Brick',
    finish: 'Textured',
    tone: '#c0392b',
    description: 'Classic red brick',
    keywords: ['brick', 'red'],
    category: 'external',
  },
  {
    id: 'timber-oak',
    name: 'Oak Timber',
    finish: 'Oiled',
    tone: '#8B6914',
    description: 'Natural oak timber cladding',
    keywords: ['timber', 'oak'],
    category: 'external',
  },
];

async function seedAndReload(page: any) {
  // Intercept the mock render URL and return a tiny PNG (app rejects data URIs in the cache)
  await page.route(MOCK_RENDER_URL, (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(TINY_PNG_B64, 'base64'),
    })
  );

  // Go to root first to establish the origin (needed for sessionStorage write)
  await page.goto('/');

  // Dismiss cookie consent if present
  const allowAllBtn = page.getByRole('button', { name: /allow all/i });
  if (await allowAllBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await allowAllBtn.click();
  }

  // Seed sessionStorage with a board and the mocked HTTP render URL
  await page.evaluate(
    ({ renderUrl, board }: { renderUrl: string; board: typeof SAMPLE_BOARD }) => {
      sessionStorage.setItem('moodboard_render_url_v1', JSON.stringify(renderUrl));
      sessionStorage.setItem(
        'moodboard_selected_materials_v1',
        JSON.stringify({ board, savedAt: new Date().toISOString() })
      );
    },
    { renderUrl: MOCK_RENDER_URL, board: SAMPLE_BOARD }
  );

  // Navigate to the moodboard page — the app reads sessionStorage on mount
  await page.goto('/moodboard');
  // Wait for the moodboard image to appear
  await page.waitForSelector('img[alt="Moodboard"]', { timeout: 15_000 });
}

test.describe('MoodboardRenderSection UI changes', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('1 — "MOODBOARD RENDER" title is absent', async ({ page }) => {
    await seedAndReload(page);
    const title = page.getByText('Moodboard Render', { exact: true });
    await expect(title).not.toBeVisible();
    await page.screenshot({ path: 'test-results/1-no-title.png', fullPage: false });
  });

  test('2 — action buttons are visible without scrolling at 1280×800', async ({ page }) => {
    await seedAndReload(page);

    // All buttons should be in the viewport without any scroll
    for (const label of ['Download sheet', 'Apply palette to project image', 'Refine']) {
      const btn = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      // Button bottom must be within the 800px viewport
      expect(box!.y + box!.height).toBeLessThan(800);
    }

    await page.screenshot({ path: 'test-results/2-buttons-visible.png', fullPage: false });
  });

  test('3 — Refine toggles textarea and Apply text edit open/closed', async ({ page }) => {
    await seedAndReload(page);

    const refineBtn = page.getByRole('button', { name: /^refine$/i });
    const textarea = page.getByPlaceholder(/add people walking/i);
    const applyBtn = page.getByRole('button', { name: /apply text edit/i });

    // Initially closed
    await expect(textarea).not.toBeVisible();
    await expect(applyBtn).not.toBeVisible();

    // Open
    await refineBtn.click();
    await expect(textarea).toBeVisible();
    await expect(applyBtn).toBeVisible();
    await page.screenshot({ path: 'test-results/3a-refine-open.png', fullPage: false });

    // Close again
    await refineBtn.click();
    await expect(textarea).not.toBeVisible();
    await expect(applyBtn).not.toBeVisible();
    await page.screenshot({ path: 'test-results/3b-refine-closed.png', fullPage: false });
  });

  test('4 — image has no surrounding border box', async ({ page }) => {
    await seedAndReload(page);
    const img = page.locator('img[alt="Moodboard"]');
    await expect(img).toBeVisible();

    // The image should NOT be inside a div that has a border-gray-200 + p-6 wrapper
    // Check parent does not have padding class p-6
    const parentHasPadding = await img.evaluate((el: HTMLElement) => {
      const parent = el.parentElement;
      return parent ? parent.classList.contains('p-6') : false;
    });
    expect(parentHasPadding).toBe(false);

    await page.screenshot({ path: 'test-results/4-no-image-box.png', fullPage: false });
  });
});
