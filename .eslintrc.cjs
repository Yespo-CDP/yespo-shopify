/** @type {import('@types/eslint').Linter.BaseConfig} */
module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
    "prettier",
  ],
  globals: {
    shopify: "readonly"
  },
  rules: {
    "react/no-unknown-property": ["error", { ignore: ["variant"] }],
    "no-constant-condition": ["error", { checkLoops: false }],
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  overrides: [
    {
      files: ["**/*.{ts,tsx}"],
      parser: "@typescript-eslint/parser",
      plugins: ["@typescript-eslint"],
      extends: ["plugin:@typescript-eslint/recommended", "prettier"],
      rules: {
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unused-vars": "warn",
      },
    },
  ],
};
