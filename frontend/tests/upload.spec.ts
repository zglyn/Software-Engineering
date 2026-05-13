import { test, expect } from '@playwright/test';

test.describe('Video Upload Flow', () => {

  test('User can upload a game tape, view it, and delete it', async ({ page }) => {
    // ---------------------------------------------------------
    // 1. LOG IN 
    // ---------------------------------------------------------
    await page.goto('http://localhost:3000/login');

    await expect(page).toHaveURL(/.*amazoncognito.com.*/);

    await page.getByPlaceholder('name@host.com').fill('vspranav2003@gmail.com');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByPlaceholder('Password').fill('Pranav03!');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(/.*\/feed/);

    // ---------------------------------------------------------
    // 2. THE UPLOAD FLOW
    // ---------------------------------------------------------
    await page.getByRole('button', { name: 'Upload video' }).click();
    await expect(page.getByRole('heading', { name: 'Upload video' })).toBeVisible();

    // FIX: No spaces in the title! This prevents the backend from adding underscores.
    const uniqueTitle = `PlaywrightTest_${Date.now()}`;
    await page.getByRole('textbox', { name: /Title/ }).fill(uniqueTitle);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('div').filter({ hasText: /^Drop a video here or click to browse$/ }).click();
    
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('tests/fixtures/dummy-video.mp4');

    await page.getByRole('button', { name: 'Upload', exact: true }).click();

    // ---------------------------------------------------------
    // 3. VERIFY UPLOADS PAGE
    // ---------------------------------------------------------
    await expect(page).toHaveURL(/.*\/uploads/);
    await expect(page.getByRole('heading', { name: 'My Uploads' })).toBeVisible();

    // Give the backend a 2-second head start to process the video in S3
    await page.waitForTimeout(2000);

    // Polling Loop: Refresh the page until our unique title appears
    await expect(async () => {
      await page.reload();
      // We use the exact locator type your Pick Locator suggested!
      await expect(page.getByRole('link', { name: uniqueTitle }).first()).toBeVisible();
    }).toPass({ timeout: 30000 });

    // Click the newly found video card link
    await page.getByRole('link', { name: uniqueTitle }).first().click();
    
    // Verify we arrived at the video page
    await expect(page).toHaveURL(/.*\/video\/.+/);
    await expect(page.getByText(/Stats not yet generated/i)).toBeVisible();

    // ---------------------------------------------------------
    // 4. THE CLEANUP
    // ---------------------------------------------------------
    await page.getByRole('link', { name: '← My uploads' }).click();
    await expect(page).toHaveURL(/.*\/uploads/);

    // Find the specific card again by looking for the container that has our title
    const videoCard = page.locator('.myUploadsCard', { hasText: uniqueTitle });
    await videoCard.getByRole('button', { name: 'Delete' }).click();
    
    await expect(videoCard).not.toBeVisible();
  });

});