## [0.2.3] 2026-06-30

### Documentation

- Updated the e2e-skills proof-point copy to reference 10+ merged upstream PRs and the shared representative project set: Storybook, code-server, Strapi, SvelteKit, Cal.com, and more.

# Changelog

All notable changes are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/); this project follows [Semantic Versioning](https://semver.org/).

## [0.2.2] — 2026-06-27

### Fixed
- Auto-fix no longer inserts `await` inside a **class field initializer or static block**, where `await` is illegal even when the outer function is `async` (it would produce a `SyntaxError` on `--fix`). Those are now report-only.
- Auto-fix no longer **drops a comment** placed between `expect(...)` and the matcher (e.g. `expect(loc) /* why */ .toBeTruthy()`); the fix is skipped (report-only) when such a comment exists.
- Auto-fix now **preserves `expect.soft(...)`** instead of silently converting a soft assertion to a hard one.
- Auto-fix is **skipped when the matcher carries an argument** (these matchers take none, but a side-effecting arg must not be dropped).
- No longer flags (or mis-fixes) a chain that ends in a **value-returning method** like `.count()` / `.isVisible()` — those return a Promise, not a Locator, so they belong to `prefer-web-first-assertions`, not here.
- `expect.soft` recognition is tightened to **only `expect.soft(...)`** (not `expect.<other>(...)` or computed `expect[fn](...)`).

_(These hardenings surfaced via two rounds of cross-model review of the upstream `eslint-plugin-playwright` port of this rule.)_

## [0.2.0] — 2026-06-27

### Changed
- Migrated the source to **TypeScript** (`src/*.ts`, built to `lib/` via `tsc`, now ships `.d.ts` types). The rule is authored with `@typescript-eslint/utils` (`RuleCreator` + `TSESTree`), mirroring `eslint-plugin-playwright`'s conventions so the rule ports cleanly upstream.
- Tests moved to **vitest** + `@typescript-eslint/rule-tester`.
- Pinned dependencies exactly to the latest compatible set (typescript-eslint 8.62.0, TypeScript 5.9.3, ESLint 9.39.4, vitest 4.1.9). TypeScript 6 / ESLint 10 are intentionally excluded — typescript-eslint 8.62 does not support them yet.
- Added an `exports` map and tightened the ESLint peer range to `>=8.57.0`.

### Notes
- **No rule behavior change** — detection, polarity, and autofix semantics are identical; the full test suite (incl. async/sync, already-awaited, return-position, `expect.soft`, and false-positive guards) was ported and is green.

## [0.1.3] — 2026-06-27

### Fixed
- Auto-fix no longer emits a doubled `await await expect(...)` when the violation is **already awaited** (`await expect(locator).toBeTruthy()` — the most common real-world shape, e.g. [calcom/cal.diy#28486](https://github.com/calcom/cal.diy/pull/28486)). The existing `await` is now reused.

### Tests
- Added edge cases: already-awaited positive/negated assertions, `return`-position fixes, and `expect.soft(<locator>)`.

## [0.1.2] — 2026-06-27

### Fixed
- Auto-fix no longer emits `await` inside a **synchronous** callback, which produced a `SyntaxError` on `eslint --fix` (`await` is only legal in an `async` function). The fix now applies only when the enclosing function is `async`; in a sync scope the violation is still reported but left unfixed.
- Diagnostic message for positive `toBeTruthy` now reads "a Playwright Locator is never **falsy**" instead of the inaccurate "never undefined".

### Tests
- Invalid cases now exercise async (auto-fixed) and sync (report-only) scopes, plus a `toBeTruthy` message-reason assertion.

## [0.1.1] — 2026-06-27

### Fixed
- README Playwright badge reverted to a plain text badge — the embedded base64 data-URI logo did not render on npmjs.com.

## [0.1.0] — 2026-06-27

### Added
- `no-silent-pass` rule — flags assertions on a Playwright `Locator` that can never fail (`expect(locator).toBeDefined()` / `.toBeTruthy()` / `.not.toBeNull()` / `.not.toBeUndefined()` / `.not.toBeFalsy()`).
- Auto-fix to `await expect(locator).toBeVisible()` for inline-locator violations.
- `checkIdentifiers` option (opt-in heuristic for identifier subjects; report-only).
- Flat config (`configs['flat/recommended']`) and legacy `configs.recommended`.
