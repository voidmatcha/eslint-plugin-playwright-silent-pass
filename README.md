# ESLint Plugin: Playwright Silent Pass

[![npm](https://img.shields.io/npm/v/eslint-plugin-playwright-silent-pass?style=flat-square&labelColor=black&color=1FC07C)](https://www.npmjs.com/package/eslint-plugin-playwright-silent-pass)
[![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=flat-square&labelColor=black)](https://playwright.dev)
[![ESLint flat config](https://img.shields.io/badge/ESLint_9-flat_config-4B32C3?style=flat-square&labelColor=black&logo=eslint&logoColor=white)](https://eslint.org)
[![Auto-fixable](https://img.shields.io/badge/auto--fixable-1FC07C?style=flat-square&labelColor=black)](#fix)
[![Part of e2e-skills](https://img.shields.io/badge/part_of-e2e--skills-D97757?style=flat-square&labelColor=black)](https://github.com/voidmatcha/e2e-skills)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-37B0E6?style=flat-square&labelColor=black)](./LICENSE)

One ESLint rule for a blind spot that `eslint-plugin-playwright` does **not** cover: assertions on a Playwright `Locator` that **can never fail**.

```js
// ❌ always passes — a Locator is never undefined / null / falsy
expect(page.getByText('Welcome back')).toBeDefined();
expect(page.locator('.user-badge')).not.toBeNull();
expect(page.getByRole('button')).toBeTruthy();

// ✅ web-first, auto-retrying, can actually fail
await expect(page.getByText('Welcome back')).toBeVisible();
```

A Playwright locator is a **synchronous object** — it is always defined, never null, always truthy. So `toBeDefined()` / `toBeTruthy()` / `not.toBeNull()` on a locator assert nothing about the page; the test stays green whether the feature works or not.

## Why a new rule?

`eslint-plugin-playwright`'s `prefer-web-first-assertions` only flags the **awaited-method** form — `expect(await locator.isVisible()).toBe(true)`. It does **not** flag the bare-locator always-true form above. `no-restricted-matchers` can ban a matcher globally but isn't locator-aware, so it false-positives on legitimate `expect(count).toBeDefined()`. This rule fills that gap and is designed to avoid false positives: it only fires when the `expect` subject is an inline chain anchored in a Playwright locator method, so plain `expect(arr.filter(x)).toBeDefined()` is never touched.

The always-pass class isn't hypothetical — fixes for it have been reviewed and merged into Ghost, code-server, SvelteKit, Strapi and others (see [e2e-skills · Proven in OSS](https://github.com/voidmatcha/e2e-skills#proven-in-open-source), 8 merged PRs). This rule catches the inline-locator slice of that class automatically.

## Install

```bash
# npm
npm i -D eslint-plugin-playwright-silent-pass

# yarn
yarn add -D eslint-plugin-playwright-silent-pass

# pnpm
pnpm add -D eslint-plugin-playwright-silent-pass

# bun
bun add -d eslint-plugin-playwright-silent-pass
```

## Usage (flat config, ESLint 9+)

```js
// eslint.config.js
import silentPass from "eslint-plugin-playwright-silent-pass";

export default [
  silentPass.configs["flat/recommended"],
];
```

Or wire the rule yourself:

```js
import silentPass from "eslint-plugin-playwright-silent-pass";

export default [
  {
    plugins: { "playwright-silent-pass": silentPass },
    rules: { "playwright-silent-pass/no-silent-pass": "error" },
  },
];
```

### Legacy `.eslintrc`

```json
{
  "plugins": ["playwright-silent-pass"],
  "rules": { "playwright-silent-pass/no-silent-pass": "error" }
}
```

### Run

```bash
npx eslint .          # or: npx eslint --fix .
bunx eslint .         # or: bunx eslint --fix .
```

## Rule: `no-silent-pass`

Flags `expect(<inline locator>)` followed by an always-true matcher:

| Matcher | Why it always passes on a Locator |
|---|---|
| `.toBeDefined()` | a Locator is never `undefined` |
| `.toBeTruthy()` | a Locator object is always truthy |
| `.not.toBeNull()` | a Locator is never `null` |
| `.not.toBeUndefined()` | a Locator is never `undefined` |
| `.not.toBeFalsy()` | a Locator object is never falsy |

A locator is recognized syntactically: an inline chain that includes a Playwright locator method — `locator`, `getByRole`, `getByText`, `getByTestId`, `getByLabel`, `getByPlaceholder`, `getByAltText`, or `getByTitle` (so `page.getByRole(...).first().filter(...)` counts; a plain `arr.filter(...)` does not).

**Auto-fixable.** `eslint --fix` rewrites inline-locator violations to `await expect(locator).toBeVisible()` (the common intent — same conservative default and `await`-insertion as the official `prefer-web-first-assertions`). Heuristic identifier matches (`checkIdentifiers`) are reported only, never auto-fixed.

### Options

```js
"playwright-silent-pass/no-silent-pass": ["error", { "checkIdentifiers": true }]
```

- `checkIdentifiers` (default `false`) — also flag `expect(<identifier>)` when the identifier name *looks* like a locator (`submitButton`, `userBadge`, `loginLink`…). A heuristic, not type-aware: more coverage, some false-positive risk. For full accuracy on indirected locators, run a type-aware checker (typescript-eslint with `parserOptions.project`).

## Scope

Catches the **mechanical, inline** always-true case. Semantic silent-pass smells — a test name that doesn't match its assertion, a delete test that never checks the row is gone, asserting the pre-state instead of the post-state — are not decidable by AST and are out of scope for any linter.

## Related

Part of a small family for catching tests that pass but prove nothing:

- **[eslint-plugin-cypress-silent-pass](https://github.com/voidmatcha/eslint-plugin-cypress-silent-pass)** — the same always-pass check for Cypress.
- **[e2e-skills](https://github.com/voidmatcha/e2e-skills)** — the full agent-skill catalog: 24 Playwright/Cypress anti-patterns, including the **semantic** silent-pass smells a linter can't decide (name↔assertion mismatch, missing post-state checks, missing auth setup, …).

This plugin is the mechanical, AST-decidable slice; `e2e-skills` covers the rest.

## License

Apache-2.0 © [voidmatcha](https://github.com/voidmatcha). See [LICENSE](./LICENSE).
