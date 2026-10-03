import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// Arabic handling needs invisible characters (bidi marks, NBSP, BOM) inside regexes and strings on purpose.
const irregularWhitespace = ["error", { skipStrings: true, skipRegExps: true, skipTemplates: true, skipComments: true }];

export default tseslint.config(
  { ignores: ["dist", ".wrangler", "node_modules", "test-results", "playwright-report", "lighthouse", "worker-configuration.d.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-irregular-whitespace": irregularWhitespace,
    },
  },
  {
    files: ["**/*.{js,mjs}"],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.node } },
    rules: { "no-irregular-whitespace": irregularWhitespace },
  },
  {
    // Playwright scripts run some code inside the page (page.evaluate), so browser globals are valid there.
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ["public/**/*.js"],
    languageOptions: { sourceType: "script", globals: { ...globals.browser } },
  },
);
