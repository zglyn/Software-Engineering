import { test, expect } from '@playwright/test';

test('User can log in successfully with two-step auth', async ({ page }) => {
  // Go to app's login route
  await page.goto('http://localhost:3000/login');

  // Redirect to AWS Hosted UI
  await expect(page).toHaveURL(/.*amazoncognito.com.*/);

  // --- STEP 1: Enter Email ---
  // (Adjust the placeholder or label text to match what is actually on your screen)
  await page.getByPlaceholder('name@host.com').fill('vspranav2003@gmail.com');
  
  // Click the button to go to the next screen. 
  await page.getByRole('button', { name: 'Next' }).click();

  // --- STEP 2: Enter Password ---
  // Playwright automatically waits here until the password box becomes visible!
  await page.getByPlaceholder('Password').fill('Pranav03!');

  // Click the final sign-in button
  await page.getByRole('button', { name: 'Continue' }).click();

  // Verify the user is redirected back to the app's protected feed/dashboard
  await expect(page).toHaveURL('http://localhost:3000/feed');
  
  // Verify a piece of UI that only logged-in users see is visible
  await expect(page.locator('text=Upload video')).toBeVisible();
});