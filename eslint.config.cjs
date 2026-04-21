const tsParser = require("@typescript-eslint/parser");
const reactHooksPlugin = require("eslint-plugin-react-hooks");

module.exports = [
  {
    files: ["src/components/**/*.tsx", "app/**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message:
            "Hardcoded hex colors zijn niet toegestaan. Gebruik tokens uit @/src/theme (colors.dark.*, brand.*, auroraPalettes).",
        },
      ],
    },
  },
];
