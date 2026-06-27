import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/voidmatcha/eslint-plugin-playwright-silent-pass/blob/main/docs/rules/${name}.md`,
);

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

// Methods that return a Locator: the creators above plus chainable locator-returning
// methods. A chain that ENDS in anything else (count, isVisible, textContent, ...)
// yields a value or Promise, not a Locator, so it must not be treated as one.
const LOCATOR_RETURNING = new Set([
  ...LOCATOR_METHODS,
  "first",
  "last",
  "nth",
  "filter",
  "and",
  "or",
]);

// matcher -> always holds for a Locator in this polarity
const POSITIVE_ALWAYS_TRUE = new Set(["toBeDefined", "toBeTruthy"]);
const NEGATED_ALWAYS_TRUE = new Set(["toBeNull", "toBeUndefined", "toBeFalsy"]);

const LOCATOR_NAME_HINT =
  /(?:locator|button|btn|link|input|field|menu|row|cell|element|elem|toggle|icon|tab|dialog|modal|badge|banner|checkbox|dropdown|item)s?$/i;

/** Non-computed member property name, else null. */
function memberName(node: TSESTree.Node): string | null {
  if (
    node.type === AST_NODE_TYPES.MemberExpression &&
    !node.computed &&
    node.property.type === AST_NODE_TYPES.Identifier
  ) {
    return node.property.name;
  }
  return null;
}

/** Property names that appear along a member/call chain. */
function chainMethodNames(node: TSESTree.Node): string[] {
  const names: string[] = [];
  let cur: TSESTree.Node | undefined = node;
  while (cur) {
    if (cur.type === AST_NODE_TYPES.CallExpression) {
      cur = cur.callee;
    } else if (cur.type === AST_NODE_TYPES.MemberExpression) {
      if (!cur.computed && cur.property.type === AST_NODE_TYPES.Identifier) {
        names.push(cur.property.name);
      }
      cur = cur.object;
    } else {
      break;
    }
  }
  return names;
}

/**
 * An inline Playwright locator chain: anchored by a creator (`locator` / `getBy*`)
 * AND still a Locator at the end. The terminal call must return a Locator, so
 * `page.locator('.x').count()` (a Promise) is not treated as one.
 */
function isInlineLocator(node: TSESTree.Node | undefined): boolean {
  if (!node || node.type !== AST_NODE_TYPES.CallExpression) return false;
  const terminal = memberName(node.callee);
  if (!terminal || !LOCATOR_RETURNING.has(terminal)) return false;
  return chainMethodNames(node).some((n) => LOCATOR_METHODS.has(n));
}

/** True when an `await` may legally be inserted at `node` (async scope, and not inside a class field initializer or static block). */
function awaitIsAllowed(node: TSESTree.Node): boolean {
  let cur: TSESTree.Node | undefined = node.parent;
  while (cur) {
    if (
      cur.type === AST_NODE_TYPES.FunctionDeclaration ||
      cur.type === AST_NODE_TYPES.FunctionExpression ||
      cur.type === AST_NODE_TYPES.ArrowFunctionExpression
    ) {
      return cur.async;
    }
    if (
      cur.type === AST_NODE_TYPES.PropertyDefinition ||
      cur.type === AST_NODE_TYPES.StaticBlock
    ) {
      return false;
    }
    cur = cur.parent;
  }
  return false;
}

export type Options = [{ checkIdentifiers?: boolean }];
export type MessageIds = "silentPass";

export default createRule<Options, MessageIds>({
  name: "no-silent-pass",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow assertions on a Playwright Locator that can never fail (always-pass / silent-pass).",
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: { checkIdentifiers: { type: "boolean" } },
        additionalProperties: false,
      },
    ],
    messages: {
      silentPass:
        "`expect(locator).{{ matcher }}` always passes — a Playwright Locator is never {{ never }}. This assertion can never fail. Assert rendered state with a web-first matcher (e.g. `await expect(locator).toBeVisible()`).",
    },
  },
  defaultOptions: [{}],
  create(context, [options]) {
    const checkIdentifiers = options?.checkIdentifiers ?? false;
    const sourceCode = context.sourceCode;

    function isLocatorArg(arg: TSESTree.Node): boolean {
      if (isInlineLocator(arg)) return true;
      if (checkIdentifiers && arg.type === AST_NODE_TYPES.Identifier) {
        return LOCATOR_NAME_HINT.test(arg.name);
      }
      return false;
    }

    return {
      CallExpression(node): void {
        if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return;
        const matcher = memberName(node.callee);
        if (
          !matcher ||
          (!POSITIVE_ALWAYS_TRUE.has(matcher) && !NEGATED_ALWAYS_TRUE.has(matcher))
        ) {
          return;
        }

        // node.callee.object is either expect(...) or expect(...).not
        let obj: TSESTree.Node = node.callee.object;
        let negated = false;
        if (
          obj.type === AST_NODE_TYPES.MemberExpression &&
          memberName(obj) === "not"
        ) {
          negated = true;
          obj = obj.object;
        }

        const positiveHit = !negated && POSITIVE_ALWAYS_TRUE.has(matcher);
        const negatedHit = negated && NEGATED_ALWAYS_TRUE.has(matcher);
        if (!positiveHit && !negatedHit) return;

        // obj must be an expect(<arg>) / expect.soft(<arg>) call
        if (obj.type !== AST_NODE_TYPES.CallExpression) return;
        const exCallee = obj.callee;
        const exName =
          exCallee.type === AST_NODE_TYPES.Identifier
            ? exCallee.name
            : exCallee.type === AST_NODE_TYPES.MemberExpression &&
                !exCallee.computed &&
                exCallee.object.type === AST_NODE_TYPES.Identifier &&
                exCallee.object.name === "expect" &&
                exCallee.property.type === AST_NODE_TYPES.Identifier &&
                exCallee.property.name === "soft"
              ? "expect" // only expect.soft(...), not expect.anythingElse(...)
              : null;
        if (exName !== "expect") return;
        if (obj.arguments.length !== 1) return;

        const arg = obj.arguments[0];
        if (arg.type === AST_NODE_TYPES.SpreadElement || !isLocatorArg(arg)) {
          return;
        }

        const never = negated
          ? matcher === "toBeNull"
            ? "null"
            : matcher === "toBeUndefined"
              ? "undefined"
              : "falsy"
          : matcher === "toBeTruthy"
            ? "falsy"
            : "undefined";
        const argText = sourceCode.getText(arg);

        context.report({
          node,
          messageId: "silentPass",
          data: { matcher: negated ? `not.${matcher}` : matcher, never },
          fix(fixer) {
            // Auto-fix only the safe inline-locator case; each guard below bails to report-only.
            // - await must be legal here (no sync callback / class field / static block)
            // - no comment between expect(...) and the matcher (the rewrite would drop it)
            // - the matcher takes no argument (don't drop a side-effecting one)
            // The fix preserves the expect callee (keeps expect.soft) and reuses any existing await.
            if (!isInlineLocator(arg)) return null;
            if (!awaitIsAllowed(node)) return null;
            if (node.arguments.length > 0) return null;
            if (
              sourceCode.getCommentsInside(node).length >
              sourceCode.getCommentsInside(arg).length
            ) {
              return null;
            }
            const alreadyAwaited =
              node.parent?.type === AST_NODE_TYPES.AwaitExpression;
            const prefix = alreadyAwaited ? "" : "await ";
            const calleeText = sourceCode.getText(obj.callee);
            return fixer.replaceText(
              node,
              `${prefix}${calleeText}(${argText}).toBeVisible()`,
            );
          },
        });
      },
    };
  },
});
