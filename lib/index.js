"use strict";

const noSilentPass = require("./rules/no-silent-pass");

const pkg = require("../package.json");

const plugin = {
  meta: { name: pkg.name, version: pkg.version },
  rules: {
    "no-silent-pass": noSilentPass,
  },
};

// Flat config (ESLint 9+)
// Config naming mirrors eslint-plugin-playwright: `flat/recommended` (flat) +
// `recommended` (legacy .eslintrc).
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

module.exports = plugin;
