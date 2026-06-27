import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/no-silent-pass";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester();

ruleTester.run("no-silent-pass", rule, {
  valid: [
    "await expect(page.getByText('Welcome back')).toBeVisible();",
    "await expect(page.locator('.user-badge')).toBeHidden();",
    "await expect(page.getByRole('button')).toHaveText('Save');",
    "expect(count).toBeDefined();",
    "expect(user).not.toBeNull();",
    "expect(result).toBeTruthy();",
    "expect(items.length).toBeTruthy();",
    "expect(await page.locator('.x').isVisible()).toBe(true);",
    "const btn = page.getByRole('button'); expect(btn).toBeDefined();",
    "expect(users.filter((u) => u.active)).toBeDefined();",
    "expect(items.first()).toBeTruthy();",
    "expect(rows.nth(2)).not.toBeNull();",
    // terminal returns a Promise/value, not a Locator — not flagged (prefer-web-first territory)
    "expect(page.locator('.x').count()).toBeTruthy();",
    "expect(page.getByRole('button').isVisible()).not.toBeFalsy();",
    // only expect.soft is treated as expect; expect.<other> is not
    "expect.notSoft(page.locator('.x')).toBeTruthy();",
  ],
  invalid: [
    {
      code: "test('t', async () => { expect(page.getByText('Welcome back')).toBeDefined(); });",
      output:
        "test('t', async () => { await expect(page.getByText('Welcome back')).toBeVisible(); });",
      errors: [
        { messageId: "silentPass", data: { matcher: "toBeDefined", never: "undefined" } },
      ],
    },
    {
      code: "test('t', async () => { expect(page.locator('.user-badge')).not.toBeNull(); });",
      output:
        "test('t', async () => { await expect(page.locator('.user-badge')).toBeVisible(); });",
      errors: [
        { messageId: "silentPass", data: { matcher: "not.toBeNull", never: "null" } },
      ],
    },
    // A: positive toBeTruthy reports the reason "falsy", not "undefined"
    {
      code: "test('t', async () => { expect(page.getByRole('button', { name: 'Save' })).toBeTruthy(); });",
      output:
        "test('t', async () => { await expect(page.getByRole('button', { name: 'Save' })).toBeVisible(); });",
      errors: [
        { messageId: "silentPass", data: { matcher: "toBeTruthy", never: "falsy" } },
      ],
    },
    {
      code: "test('t', async () => { expect(page.getByTestId('row').first()).not.toBeUndefined(); });",
      output:
        "test('t', async () => { await expect(page.getByTestId('row').first()).toBeVisible(); });",
      errors: [{ messageId: "silentPass" }],
    },
    {
      code: "test('t', async () => { expect(page.locator('.menu').filter({ hasText: 'A' })).not.toBeFalsy(); });",
      output:
        "test('t', async () => { await expect(page.locator('.menu').filter({ hasText: 'A' })).toBeVisible(); });",
      errors: [{ messageId: "silentPass" }],
    },
    {
      code: "test('t', async () => { expect(component.getByText('hi')).toBeDefined(); });",
      output:
        "test('t', async () => { await expect(component.getByText('hi')).toBeVisible(); });",
      errors: [{ messageId: "silentPass" }],
    },
    // C: already-awaited assertion (the real-world Cal.com#28486 shape) — reuse the
    // existing `await`, do NOT emit `await await expect(...)`.
    {
      code: "test('t', async () => { await expect(page.getByTestId('away-emoji')).toBeTruthy(); });",
      output:
        "test('t', async () => { await expect(page.getByTestId('away-emoji')).toBeVisible(); });",
      errors: [
        { messageId: "silentPass", data: { matcher: "toBeTruthy", never: "falsy" } },
      ],
    },
    // C edge: already-awaited negated form
    {
      code: "test('t', async () => { await expect(page.locator('.x')).not.toBeNull(); });",
      output:
        "test('t', async () => { await expect(page.locator('.x')).toBeVisible(); });",
      errors: [{ messageId: "silentPass" }],
    },
    // edge: return position (async) — fix prepends await, stays valid
    {
      code: "const f = async () => { return expect(page.getByRole('button')).toBeDefined(); };",
      output:
        "const f = async () => { return await expect(page.getByRole('button')).toBeVisible(); };",
      errors: [{ messageId: "silentPass" }],
    },
    // edge: expect.soft is caught AND the soft callee is preserved in the fix
    {
      code: "test('t', async () => { await expect.soft(page.getByText('x')).toBeTruthy(); });",
      output:
        "test('t', async () => { await expect.soft(page.getByText('x')).toBeVisible(); });",
      errors: [{ messageId: "silentPass" }],
    },
    // matcher carrying a (side-effecting) argument — reported, but NOT auto-fixed,
    // since the rewrite would drop the argument.
    {
      code: "test('t', async () => { expect(page.locator('.x')).toBeTruthy(sideEffect()); });",
      output: null,
      errors: [{ messageId: "silentPass" }],
    },
    // B: sync callback — reported, but NOT auto-fixed (await would be a SyntaxError)
    {
      code: "test('t', () => { expect(page.getByText('hi')).toBeDefined(); });",
      output: null,
      errors: [{ messageId: "silentPass" }],
    },
    // await-boundary: a class field initializer disallows await even when the
    // outer scope is async — reported, but NOT auto-fixed.
    {
      code: "class C { field = expect(page.locator('.x')).toBeTruthy(); }",
      output: null,
      errors: [{ messageId: "silentPass" }],
    },
    // comment between expect() and the matcher — reported, but NOT auto-fixed
    // (the rewrite would drop the comment).
    {
      code: "test('t', async () => { await expect(page.getByText('x')) /* keep */ .toBeDefined(); });",
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
