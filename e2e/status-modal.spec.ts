import { test, expect } from '@playwright/test';

test.describe('StatusSettingsModal Core Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the local dev server
    await page.goto('http://localhost:1430');
    
    // Wait for the app to load and character widget to appear
    await page.waitForSelector('.character-container');
    
    // Open context menu (right click)
    await page.locator('.character-container').click({ button: 'right' });
    
    // Click "⚙️ Settings..."
    await page.getByText('⚙️ Settings...').click();
    
    // Wait for modal to open
    await expect(page.getByText('Custom Status & Reminders')).toBeVisible();
  });

  test('Scenario 1: Open -> Fill -> Save -> List Update -> Close', async ({ page }) => {
    // Add new status
    await page.getByRole('button', { name: 'Add Status' }).click();
    
    // Verify new status is added to the sidebar
    await expect(page.getByText('New Status').first()).toBeVisible();
    
    // Fill form
    await page.getByLabel('Status Name').fill('E2E Test Status');
    await page.getByLabel('Icon (Emoji)').fill('🧪');
    await page.getByLabel('Message on Entry').fill('Running automated tests');
    
    // Add reminder
    await page.getByRole('button', { name: 'Add Rule' }).click();
    
    // Fill reminder message
    const reminderInput = page.getByPlaceholder('Reminder Message'); // Need to check if this placeholder was translated
    await reminderInput.fill('Are the tests done?');
    
    // Save configuration
    await page.getByRole('button', { name: 'Save Settings' }).click();
    
    // Verify saving state
    await expect(page.getByText('Saving...')).toBeVisible();
    
    // Verify success toast
    await expect(page.getByText('Settings saved successfully')).toBeVisible();
    
    // Verify modal is closed automatically
    await expect(page.getByText('Custom Status & Reminders')).not.toBeVisible();
    
    // Verify list update by reopening
    await page.locator('.character-container').click({ button: 'right' });
    
    // Check if the new status appears in the context menu
    // The exact text depends on how it's rendered in CharacterWidget, assuming it uses the label
    await expect(page.getByText('E2E Test Status')).toBeVisible();
  });

  test('Scenario 2: Validation Error Handling', async ({ page }) => {
    // Select first status
    await page.getByText('Working').first().click();
    
    // Clear label to trigger validation error
    await page.getByLabel('Status Name').fill('');
    
    // Try to save
    await page.getByRole('button', { name: 'Save Settings' }).click();
    
    // Verify error message
    await expect(page.getByText('Status name cannot be empty')).toBeVisible();
    
    // Verify retry button exists
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    
    // Modal should stay open
    await expect(page.getByText('Custom Status & Reminders')).toBeVisible();
  });

  test('Scenario 3: Simulated Network Error Handling', async ({ page }) => {
    // Add new status
    await page.getByRole('button', { name: 'Add Status' }).click();
    
    // Fill specific label to trigger simulated 500 error in store
    await page.getByLabel('Status Name').fill('error_500');
    
    // Try to save
    await page.getByRole('button', { name: 'Save Settings' }).click();
    
    // Verify error message
    await expect(page.getByText('500: Server Internal Error')).toBeVisible();
    
    // Modal should stay open
    await expect(page.getByText('Custom Status & Reminders')).toBeVisible();
    
    // Cancel to close
    await page.getByRole('button', { name: 'Cancel' }).click();
    
    // Verify modal is closed
    await expect(page.getByText('Custom Status & Reminders')).not.toBeVisible();
  });
});
