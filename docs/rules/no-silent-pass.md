# Disallow assertions on a Locator that can never fail (`no-silent-pass`)

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/use/command-line-interface#--fix).

A Playwright `Locator` is a synchronous object — it is always defined, never
null, and always truthy. So generic value matchers applied directly to a locator
assert nothing about the page and **can never fail**: the test stays green
whether the feature works or not.

## Rule details

This rule flags `expect(<locator>)` followed by a matcher that always holds for a
`Locator`:

| Matcher | Why it always passes |
| --- | --- |
| `.toBeDefined()` | a Locator is never `undefined` |
| `.toBeTruthy()` | a Locator object is always truthy |
| `.not.toBeNull()` | a Locator is never `null` |
| `.not.toBeUndefined()` | a Locator is never `undefined` |
| `.not.toBeFalsy()` | a Locator object is never falsy |

A locator is recognized syntactically as an inline chain that includes a
Playwright locator method — `locator`, `getByRole`, `getByText`, `getByTestId`,
`getByLabel`, `getByPlaceholder`, `getByAltText`, or `getByTitle`. Chained
methods like `.first()` / `.filter()` count when the chain starts with one of
these; a plain `arr.filter(...)` does not.

This is the gap left by `prefer-web-first-assertions`, which only flags the
awaited-method form (`expect(await locator.isVisible()).toBe(true)`), not the
bare-locator form above.

The following patterns are warnings:

```js
expect(page.getByText('Welcome back')).toBeDefined();
expect(page.locator('.user-badge')).not.toBeNull();
expect(page.getByRole('button', { name: 'Save' })).toBeTruthy();
```

The following patterns are not warnings:

```js
await expect(page.getByText('Welcome back')).toBeVisible();
await expect(page.locator('.user-badge')).toBeHidden();
expect(count).toBeDefined();          // non-locator subject
expect(await page.locator('.x').isVisible()).toBe(true); // covered by prefer-web-first-assertions
```

## Fix

The autofix rewrites inline-locator violations to the common web-first intent,
inserting `await`:

```diff
- expect(page.getByText('Welcome back')).toBeDefined();
+ await expect(page.getByText('Welcome back')).toBeVisible();
```

Because the fix inserts `await`, it is applied **only inside an `async`
function** — the usual Playwright test callback. In a synchronous callback the
violation is still reported but left unfixed, so `--fix` never emits an `await`
outside an async function (which would be a `SyntaxError`). When the assertion is
**already awaited** (`await expect(loc).toBeTruthy()`), the existing `await` is
reused — the fix never emits `await await`. `toBeVisible()` is a sensible default;
if the test means to assert text or attachment instead, adjust the matcher.

## Options

```jsonc
{
  "playwright-silent-pass/no-silent-pass": ["error", { "checkIdentifiers": true }]
}
```

- `checkIdentifiers` (default `false`) — also flag `expect(<identifier>)` when the
  identifier name looks like a locator (`submitButton`, `userBadge`…). A
  heuristic, not type-aware; reported only, never auto-fixed. For accuracy on
  indirected locators, use a type-aware checker (typescript-eslint with
  `parserOptions.project`).
