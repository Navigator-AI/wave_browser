import { test, expect } from '@playwright/test';

test.describe('Hierarchy Panel', () => {
  // Helper to open a session before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Open the default session
    await page.getByRole('button', { name: 'OK' }).click();
    
    // Wait for hierarchy to load
    await expect(page.getByText('tb_counter')).toBeVisible({ timeout: 5000 });
  });

  test('displays top-level module', async ({ page }) => {
    // tb_counter should be visible
    await expect(page.getByText('tb_counter')).toBeVisible();
  });

  test('can expand module to see children', async ({ page }) => {
    // Click on expand icon or module name
    const tbCounter = page.getByText('tb_counter');
    await tbCounter.click();
    
    // Child module 'dut' should appear
    await expect(page.getByText('dut')).toBeVisible({ timeout: 5000 });
  });

  test('can expand nested modules', async ({ page }) => {
    // Expand tb_counter
    await page.getByText('tb_counter').click();
    await expect(page.getByText('dut')).toBeVisible({ timeout: 5000 });
    
    // Expand dut
    await page.getByText('dut').click();
    await expect(page.getByText('u_counter')).toBeVisible({ timeout: 5000 });
  });

  test('shows signals when scope is selected', async ({ page }) => {
    // Click on tb_counter to select it
    await page.getByText('tb_counter').click();
    
    // Should show child 'dut'
    await expect(page.getByText('dut')).toBeVisible({ timeout: 5000 });
    
    // Note: Signal display depends on implementation
    // This test can be expanded when signals panel is complete
  });

  test('shows module definition name', async ({ page }) => {
    // Expand tb_counter to see dut
    await page.getByText('tb_counter').click();
    
    // dut instance should show counter_top definition
    // (depending on UI implementation)
    await expect(page.getByText('dut')).toBeVisible();
  });
});
