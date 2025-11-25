/** @type {import('@types/eslint').Linter.BaseConfig} */
module.exports = {
  root: true,
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier",
  ],
  globals: {
    shopify: "readonly"
  },
  rules: {
    "react/no-unknown-property": ["error", { ignore: ["variant"] }],
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
