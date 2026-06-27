# Changelog

All notable changes are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/); this project follows [Semantic Versioning](https://semver.org/).

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
