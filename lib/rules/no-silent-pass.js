"use strict";

/**
 * Flags assertions on a Playwright Locator that can never fail, because a
 * Locator is a synchronous object that is always defined / truthy / non-null:
 *
 *   expect(page.getByText('x')).toBeDefined()     // always passes
 *   expect(page.locator('.x')).toBeTruthy()       // always passes
 *   expect(page.getByRole('button')).not.toBeNull() // always passes
 *
 * The intent is almost always to assert rendered DOM state. The fix is a
 * web-first, auto-retrying assertion:  await expect(locator).toBeVisible()
 *
 * Detection is syntactic (no type info): the expect() argument must be an
 * inline Playwright locator call. Locators stored in variables / returned from
 * POM helpers are intentionally NOT flagged here to keep false positives at
 * zero — enable the optional `checkIdentifiers` option for a looser heuristic.
 */

const LOCATOR_METHODS = new Set([
  "locator",
  "getByRole",
  "getByText",
  "getByLabel",
  "getByPlaceholder",
  "getByAltText",
  "getByTitle",
  "getByTestId",
]);
// Generic chain methods (first/last/nth/filter/and/or) are intentionally NOT
// here: they also belong to arrays, query builders, RxJS, etc. A real Playwright
// locator chain always starts with one of the methods above, so requiring a
// Playwright-specific anchor avoids flagging e.g. `expect(arr.filter(x)).toBeDefined()`.

// matcher -> true when it ALWAYS holds for a Locator in this polarity
const POSITIVE_ALWAYS_TRUE = new Set(["toBeDefined", "toBeTruthy"]);
const NEGATED_ALWAYS_TRUE = new Set(["toBeNull", "toBeUndefined", "toBeFalsy"]);

const LOCATOR_NAME_HINT = /(?:locator|button|btn|link|input|field|menu|row|cell|element|elem|toggle|icon|tab|dialog|modal|badge|banner|checkbox|dropdown|item)s?$/i;

function calleeName(node) {
  if (node.type === "MemberExpression" && node.property && !node.computed) {
    return node.property.name;
  }
  return null;
}

/** Walk a member/call chain and collect the property names that appear. */
function chainMethodNames(node) {
  const names = [];
  let cur = node;
  while (cur) {
    if (cur.type === "CallExpression") {
      cur = cur.callee;
    } else if (cur.type === "MemberExpression") {
      if (cur.property && !cur.computed && cur.property.name) {
        names.push(cur.property.name);
      }
      cur = cur.object;
    } else {
      break;
    }
  }
  return names;
}

function isInlineLocator(node) {
  if (!node) return false;
  if (node.type !== "CallExpression") return false;
  return chainMethodNames(node).some((n) => LOCATOR_METHODS.has(n));
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow assertions on a Playwright Locator that can never fail (always-pass / silent-pass).",
      recommended: true,
      url: "https://github.com/voidmatcha/eslint-plugin-playwright-silent-pass/blob/main/docs/rules/no-silent-pass.md",
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          checkIdentifiers: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      silentPass:
        "`expect(locator).{{ matcher }}` always passes — a Playwright Locator is never {{ never }}. This assertion can never fail. Assert rendered state with a web-first matcher (e.g. `await expect(locator).toBeVisible()`).",
    },
  },

  create(context) {
    const checkIdentifiers = context.options[0] && context.options[0].checkIdentifiers;
    const sourceCode = context.sourceCode || context.getSourceCode();

    function isLocatorArg(arg) {
      if (isInlineLocator(arg)) return true;
      if (checkIdentifiers && arg && arg.type === "Identifier") {
        return LOCATOR_NAME_HINT.test(arg.name);
      }
      return false;
    }

    return {
      CallExpression(node) {
        const matcher = calleeName(node.callee);
        if (!matcher) return;
        if (!POSITIVE_ALWAYS_TRUE.has(matcher) && !NEGATED_ALWAYS_TRUE.has(matcher)) {
          return;
        }

        // node.callee.object is either expect(...) or expect(...).not
        let obj = node.callee.object;
        let negated = false;
        if (obj && obj.type === "MemberExpression" && calleeName(obj) === "not") {
          negated = true;
          obj = obj.object;
        }

        const positiveHit = !negated && POSITIVE_ALWAYS_TRUE.has(matcher);
        const negatedHit = negated && NEGATED_ALWAYS_TRUE.has(matcher);
        if (!positiveHit && !negatedHit) return;

        // obj must be an expect(<arg>) call
        if (!obj || obj.type !== "CallExpression") return;
        const exCallee = obj.callee;
        const exName =
          exCallee.type === "Identifier"
            ? exCallee.name
            : exCallee.type === "MemberExpression" && exCallee.object.type === "Identifier"
            ? exCallee.object.name // expect.soft(...)
            : null;
        if (exName !== "expect") return;
        if (obj.arguments.length !== 1) return;

        const arg = obj.arguments[0];
        if (!isLocatorArg(arg)) return;

        const never = negated
          ? matcher === "toBeNull"
            ? "null"
            : matcher === "toBeUndefined"
            ? "undefined"
            : "falsy"
          : "undefined";
        const argText = sourceCode.getText(arg);

        context.report({
          node,
          messageId: "silentPass",
          data: { matcher: negated ? `not.${matcher}` : matcher, never },
          // Autofix only the high-confidence inline-locator case to a sensible
          // web-first default. Heuristic identifier matches are report-only.
          fix(fixer) {
            if (!isInlineLocator(arg)) return null;
            return fixer.replaceText(node, `await expect(${argText}).toBeVisible()`);
          },
        });
      },
    };
  },
};
