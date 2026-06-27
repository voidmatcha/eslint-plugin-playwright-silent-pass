import noSilentPass from "./rules/no-silent-pass";

const { name, version } = require("../package.json") as {
  name: string;
  version: string;
};

const plugin = {
  meta: { name, version },
  rules: {
    "no-silent-pass": noSilentPass,
  },
  configs: {} as Record<string, unknown>,
};

// Flat config (ESLint 9+) + legacy `.eslintrc`. Config naming mirrors
// eslint-plugin-playwright: `flat/recommended` (flat) + `recommended` (legacy).
plugin.configs = {
  "flat/recommended": {
    plugins: { "playwright-silent-pass": plugin },
    rules: {
      "playwright-silent-pass/no-silent-pass": "error",
    },
  },
  recommended: {
    plugins: ["playwright-silent-pass"],
    rules: {
      "playwright-silent-pass/no-silent-pass": "error",
    },
  },
};

export = plugin;
