/**
 * UI element coverage — every key interactive surface has a Playwright
 * assertion (visible / enabled / correct text or href).
 *
 * Selector strategy: role + accessible-name preferred (resilient to
 * styling churn). Where ui-inventory.md flagged `← TODO add` for a
 * data-testid, we skip the element here rather than blanket-modify
 * the source — those testids wire in on demand alongside the test
 * that needs them.
 *
 * Step 16 (ADR-093). Pairs with the smoke spec — smoke catches
 * console errors, this catches missing/broken interactive elements.
 *
 * DoD: ≥30 assertions, all pass.
 */

import { test, expect } from '@playwright/test';

test.describe('UI elements — Index `/`', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('headings + goal input', async ({ page }) => {
    // Top-level page heading (widgetConfig.title default)
    await expect(
      page.getByRole('heading', { level: 1, name: /goal[- ]oriented action planning/i }),
    ).toBeVisible();

    // GoalInput section heading + the textarea
    await expect(
      page.getByRole('heading', { name: /define research objective/i }),
    ).toBeVisible();
    await expect(page.getByRole('textbox')).toBeVisible();

    // GoalInput "Advanced" button (G-02 in ui-inventory)
    const advancedBtn = page.getByRole('button', { name: /advanced/i }).first();
    await expect(advancedBtn).toBeVisible();
  });

  test('8 category buttons all visible + enabled', async ({ page }) => {
    // G-05..G-12 in ui-inventory.md — each fires generateGoals(category)
    // which today calls Supabase edge functions (Step 19 ports to LOCAL_FN).
    const labels = [
      /finance/i, /business/i, /marketing/i, /medical/i,
      /education/i, /coding/i, /technical/i, /ai.*ml/i,
    ];
    for (const label of labels) {
      const btn = page.getByRole('button', { name: label }).first();
      await expect(btn, `category button matching ${label}`).toBeVisible();
      await expect(btn, `category button matching ${label} enabled`).toBeEnabled();
    }
  });

  test('navigation links to /demo and /agents', async ({ page }) => {
    // Visible text is "Widget Demo" / "Agent Swarm" at sm+ breakpoint
    // (the short "Demo" / "Agents" forms are sm:hidden and not in the
    // accessibility tree at the 1280px test viewport).
    const demoLink = page.getByRole('link', { name: /widget demo/i });
    await expect(demoLink).toBeVisible();
    await expect(demoLink).toHaveAttribute('href', '/demo');

    const agentsLink = page.getByRole('link', { name: /agent swarm/i });
    await expect(agentsLink).toBeVisible();
    await expect(agentsLink).toHaveAttribute('href', '/agents');
  });
});

test.describe('UI elements — Agents `/agents`', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/agents');
  });

  test('headline + primary action', async ({ page }) => {
    // h1 "Coding Agent Swarm" (verified in smoke; re-asserted here for
    // grouping cohesion with the rest of /agents coverage)
    await expect(
      page.getByRole('heading', { level: 1, name: /coding agent swarm/i }),
    ).toBeVisible();

    // Define-what-to-build card description text (A-01 in ui-inventory)
    await expect(
      page.getByText(/define what you want the agent swarm to build/i),
    ).toBeVisible();

    // Generate Plan button (A-02 — primary action on this page).
    // It's disabled by default (`disabled={!goal.trim() || isRunning}`)
    // — that's the CORRECT initial state, so we assert disabled.
    // After entering a goal, we re-assert enabled to confirm the
    // disabled-gate is wired to the input.
    const generateBtn = page.getByRole('button', { name: /generate plan/i });
    await expect(generateBtn).toBeVisible();
    await expect(generateBtn).toBeDisabled();

    // Type a goal into the textarea — the button should become enabled
    const goalArea = page.getByRole('textbox').first();
    await goalArea.fill('Test goal for e2e coverage');
    await expect(generateBtn).toBeEnabled();
  });
});

test.describe('UI elements — Demo `/demo`', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo');
  });

  test('headings + widget preview area', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: /embeddable widget demo/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /live widget preview/i }),
    ).toBeVisible();
  });
});

test.describe('UI elements — NotFound `/notexist`', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/notexist');
  });

  test('404 page elements', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: /^404$/ })).toBeVisible();
    await expect(page.getByText(/page not found/i)).toBeVisible();

    // "Return to Home" link, points to /
    const homeLink = page.getByRole('link', { name: /return to home/i });
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveAttribute('href', '/');
  });
});
