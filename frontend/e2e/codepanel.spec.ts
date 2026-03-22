import { test, expect } from '@playwright/test';

test.describe('Code Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Go to root - this triggers demo mode (no URL params)
    await page.goto('/');
    
    // Wait for demo mode to load - look for DEMO MODE indicator
    await expect(page.getByText('DEMO MODE')).toBeVisible({ timeout: 5000 });
    
    // Also verify hierarchy is showing
    await expect(page.getByText('HIERARCHY')).toBeVisible({ timeout: 5000 });
  });

  // Helper to expand hierarchy and click dut
  async function openCodePanel(page: import('@playwright/test').Page) {
    // First expand tb to see dut - click the expand button (first button in the tb row)
    const tbRow = page.locator('text=tb').first().locator('..');
    await tbRow.locator('button').first().click();
    
    // Now dut should be visible
    await expect(page.getByText('dut').first()).toBeVisible({ timeout: 3000 });
    
    // Click dut to trigger code panel
    await page.getByText('dut').first().click();
    
    // Wait for code panel - look for the specific file path
    await expect(page.getByText('/demo/tb/tb_counter.v')).toBeVisible({ timeout: 3000 });
  }

  test('clicking a scope shows code panel with content', async ({ page }) => {
    await openCodePanel(page);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/codepanel-expanded.png' });
    
    // Editor content should exist (CodeMirror creates .cm-content)
    const editorContent = page.locator('.cm-content');
    await expect(editorContent).toBeVisible({ timeout: 3000 });
    
    // Content should not be empty
    const text = await editorContent.textContent();
    expect(text?.length).toBeGreaterThan(10);
  });

  test('expanded code panel has correct button count', async ({ page }) => {
    await openCodePanel(page);
    
    // Count minimize buttons (should be exactly 1)
    const minimizeButtons = page.locator('[title="Minimize"]');
    await expect(minimizeButtons).toHaveCount(1);
    
    // Count maximize buttons (should be exactly 1)  
    const maximizeButtons = page.locator('[title="Maximize"]');
    await expect(maximizeButtons).toHaveCount(1);
  });

  test('maximized code panel shows restore button instead of maximize', async ({ page }) => {
    await openCodePanel(page);
    
    // Click maximize
    await page.click('[title="Maximize"]');
    
    // Take screenshot of maximized state
    await page.screenshot({ path: 'test-results/codepanel-maximized.png' });
    
    // Should now show "Restore" button, NOT "Maximize"
    const restoreButton = page.locator('[title="Restore"]');
    const maximizeButton = page.locator('[title="Maximize"]');
    
    await expect(restoreButton).toHaveCount(1);
    await expect(maximizeButton).toHaveCount(0);
  });

  test('maximized code panel has only restore button (no minimize)', async ({ page }) => {
    await openCodePanel(page);
    
    // Click maximize
    await page.click('[title="Maximize"]');
    
    // In maximized state, Minimize button should be hidden
    const minimizeButtons = page.locator('[title="Minimize"]');
    await expect(minimizeButtons).toHaveCount(0);
    
    // But Restore button should exist
    const restoreButton = page.locator('[title="Restore"]');
    await expect(restoreButton).toHaveCount(1);
  });

  test('code panel shows actual code text', async ({ page }) => {
    await openCodePanel(page);
    
    // Should see actual Verilog code keywords in the editor
    const codeContent = page.locator('.cm-content');
    await expect(codeContent).toBeVisible({ timeout: 3000 });
    
    // Check that content contains Verilog-like text (dut instantiation is visible at line 36)
    const text = await codeContent.textContent();
    expect(text).toContain('dut');  // The instantiation name
    expect(text).toContain('clk');  // Signal connections
  });

  test('close button removes code panel', async ({ page }) => {
    await openCodePanel(page);
    
    // Click close
    await page.click('[title="Close"]');
    
    // Code panel file path should be gone
    await expect(page.getByText('/demo/tb/tb_counter.v')).not.toBeVisible();
  });

  test('clicking ALU module shows ALU source code', async ({ page }) => {
    // Expand tb -> dut -> alu
    const tbRow = page.locator('text=tb').first().locator('..');
    await tbRow.locator('button').first().click();
    
    // Wait for and expand dut
    await expect(page.getByText('dut').first()).toBeVisible({ timeout: 3000 });
    const dutRow = page.getByText('dut').first().locator('..');
    await dutRow.locator('button').first().click();
    
    // Wait for ALU to appear
    await expect(page.getByText('alu').first()).toBeVisible({ timeout: 3000 });
    
    // Click ALU to trigger code panel
    await page.getByText('alu').first().click();
    
    // Code panel should show ALU file path
    await expect(page.getByText('/demo/rtl/alu.v')).toBeVisible({ timeout: 3000 });
    
    // Editor content should exist
    const editorContent = page.locator('.cm-content');
    await expect(editorContent).toBeVisible({ timeout: 3000 });
    
    // Content should contain ALU-specific keywords
    const text = await editorContent.textContent();
    expect(text).toContain('alu');
    expect(text).toContain('OP_ADD');  // ALU operation constant
  });
});
