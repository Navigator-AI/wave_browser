import { test, expect } from '@playwright/test';

test.describe('Session Dialog', () => {
  test('shows dialog on initial load', async ({ page }) => {
    await page.goto('/');
    
    // Dialog should be visible
    await expect(page.getByRole('heading', { name: 'Open Design Database' })).toBeVisible();
    
    // Default path should be populated
    const input = page.getByPlaceholder(/path to/i);
    await expect(input).toBeVisible();
  });

  test('can open a design database', async ({ page }) => {
    await page.goto('/');
    
    // Wait for dialog
    await expect(page.getByRole('heading', { name: 'Open Design Database' })).toBeVisible();
    
    // Click OK button
    await page.getByRole('button', { name: 'OK' }).click();
    
    // Dialog should close
    await expect(page.getByRole('heading', { name: 'Open Design Database' })).not.toBeVisible();
    
    // Hierarchy should show tb_counter
    await expect(page.getByText('tb_counter')).toBeVisible({ timeout: 5000 });
  });

  test('shows error for invalid database', async ({ page }) => {
    await page.goto('/');
    
    // Clear the input and enter invalid path
    const input = page.getByPlaceholder(/path to/i);
    await input.clear();
    await input.fill('');
    
    // OK button should be disabled when empty
    await expect(page.getByRole('button', { name: 'OK' })).toBeDisabled();
  });

  test('can cancel dialog', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.getByRole('heading', { name: 'Open Design Database' })).toBeVisible();
    
    // Click Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    
    // Dialog should close
    await expect(page.getByRole('heading', { name: 'Open Design Database' })).not.toBeVisible();
  });

  test('shows advanced options for FSDB', async ({ page }) => {
    await page.goto('/');
    
    // Click show advanced
    await page.getByText('Show Advanced').click();
    
    // FSDB input should appear
    await expect(page.getByPlaceholder(/fsdb/i)).toBeVisible();
  });
});
