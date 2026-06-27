"use strict";

const { RuleTester } = require("eslint");
const rule = require("../lib/rules/no-silent-pass");

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

ruleTester.run("no-silent-pass", rule, {
  valid: [
    // web-first assertions — the correct form
    "await expect(page.getByText('Welcome back')).toBeVisible();",
    "await expect(page.locator('.user-badge')).toBeHidden();",
    "await expect(page.getByRole('button')).toHaveText('Save');",
    // non-locator subjects genuinely need these matchers
    "expect(count).toBeDefined();",
    "expect(user).not.toBeNull();",
    "expect(result).toBeTruthy();",
    "expect(items.length).toBeTruthy();",
    // a real awaited boolean read (handled by prefer-web-first-assertions, not us)
    "expect(await page.locator('.x').isVisible()).toBe(true);",
    // identifier locator NOT flagged by default (no type info)
    "const btn = page.getByRole('button'); expect(btn).toBeDefined();",
    // generic chain methods without a Playwright anchor are NOT flagged
    "expect(users.filter((u) => u.active)).toBeDefined();",
    "expect(items.first()).toBeTruthy();",
    "expect(rows.nth(2)).not.toBeNull();",
  ],
  invalid: [
    {
      code: "test('t', async () => { expect(page.getByText('Welcome back')).toBeDefined(); });",
      output: "test('t', async () => { await expect(page.getByText('Welcome back')).toBeVisible(); });",
      errors: [{ messageId: "silentPass", data: { matcher: "toBeDefined", never: "undefined" } }],
    },
    {
      code: "test('t', async () => { expect(page.locator('.user-badge')).not.toBeNull(); });",
      output: "test('t', async () => { await expect(page.locator('.user-badge')).toBeVisible(); });",
      errors: [{ messageId: "silentPass", data: { matcher: "not.toBeNull", never: "null" } }],
    },
    // A: positive toBeTruthy must report the reason "falsy" (a Locator is never falsy), not "undefined"
    {
      code: "test('t', async () => { expect(page.getByRole('button', { name: 'Save' })).toBeTruthy(); });",
      output: "test('t', async () => { await expect(page.getByRole('button', { name: 'Save' })).toBeVisible(); });",
      errors: [{ messageId: "silentPass", data: { matcher: "toBeTruthy", never: "falsy" } }],
    },
    {
      code: "test('t', async () => { expect(page.getByTestId('row').first()).not.toBeUndefined(); });",
      output: "test('t', async () => { await expect(page.getByTestId('row').first()).toBeVisible(); });",
      errors: [{ messageId: "silentPass" }],
    },
    {
      code: "test('t', async () => { expect(page.locator('.menu').filter({ hasText: 'A' })).not.toBeFalsy(); });",
      output: "test('t', async () => { await expect(page.locator('.menu').filter({ hasText: 'A' })).toBeVisible(); });",
      errors: [{ messageId: "silentPass" }],
    },
    // subject need not be `page` — any inline locator chain counts
    {
      code: "test('t', async () => { expect(component.getByText('hi')).toBeDefined(); });",
      output: "test('t', async () => { await expect(component.getByText('hi')).toBeVisible(); });",
      errors: [{ messageId: "silentPass" }],
    },
    // B: synchronous callback — still REPORTED, but NOT auto-fixed, because injecting
    // `await` into a non-async function would be a SyntaxError on `eslint --fix`.
    {
      code: "test('t', () => { expect(page.getByText('hi')).toBeDefined(); });",
      output: null,
      errors: [{ messageId: "silentPass" }],
    },
    // identifier flagged only with the opt-in heuristic — report only, NOT autofixed
    {
      code: "expect(submitButton).toBeDefined();",
      options: [{ checkIdentifiers: true }],
      output: null,
      errors: [{ messageId: "silentPass" }],
    },
  ],
});

console.log("no-silent-pass (playwright): all assertions passed");
