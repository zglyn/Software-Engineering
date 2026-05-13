import { test, expect } from '@playwright/test';

let uploadedVideoId = ''; // Variable to hold the ID for cleanup

test.describe('Video Upload Flow', () => {

  test('User can upload a game tape and it gets cleaned up', async ({ page }) => {
    // ---------------------------------------------------------
    // 1. LOG IN 
    // ---------------------------------------------------------
    await page.goto('http://localhost:3000/login');

    // Redirect to AWS Hosted UI
    await expect(page).toHaveURL(/.*amazoncognito.com.*/);

    await page.getByPlaceholder('name@host.com').fill('vspranav2003@gmail.com');
    
    // Click the button to go to the next screen. 
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByPlaceholder('Password').fill('Pranav03!');

    // Click the final sign-in button
    await page.getByRole('button', { name: 'Continue' }).click();

    // Ensure we actually made it to the feed before continuing
    await expect(page).toHaveURL(/.*\/feed/);

    // ---------------------------------------------------------
    // 2. THE UPLOAD FLOW
    // ---------------------------------------------------------
    // Open the Upload Modal
    await page.getByRole('button', { name: 'Upload video' }).click();

    // Fill out the Title box
    // Note: If your input uses a placeholder instead of an HTML <label>, 
    // change getByLabel to getByPlaceholder('Title')
    await page.getByPlaceholder('Title').fill('Playwright Test Game Tape');

    // Tell Playwright to get ready to catch the file browser popup
    const fileChooserPromise = page.waitForEvent('filechooser');

    // Click your exact drag-and-drop text to trigger the file explorer
    await page.getByText('Drag a video here or click to browse').click(); 

    // Catch the popup and attach the dummy video
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('tests/fixtures/dummy-video.mp4');

    // Submit the upload modal
    await page.getByRole('button', { name: 'Upload' }).click();

    // ---------------------------------------------------------
    // 3. VERIFY AND EXTRACT ID
    // ---------------------------------------------------------
    // Wait for the app to redirect to the new video page
    await expect(page).toHaveURL(/.*\/video\/.+/);
    await expect(page.getByText(/Stats not yet generated/i)).toBeVisible();

    // Extract the video ID for cleanup
    const currentUrl = page.url();
    uploadedVideoId = currentUrl.split('/').pop() || '';
  });

  // ---------------------------------------------------------
  // 4. THE CLEANUP
  // ---------------------------------------------------------
  test.afterAll(async ({ request }) => {
    if (uploadedVideoId) {
      console.log(`Cleaning up test video ID: ${uploadedVideoId}`);
      await request.delete(`http://localhost:3001/api/videos/${uploadedVideoId}`);
    }
  });

});