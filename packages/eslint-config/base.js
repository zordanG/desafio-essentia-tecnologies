import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import onlyWarn from "eslint-plugin-only-warn";
import tseslint from "typescript-eslint";

const sourceFiles = ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"];

/**
 * A shared ESLint flat configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = tseslint.config(
  {
    files: sourceFiles,
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      eslintConfigPrettier,
      {
        plugins: {
          turbo: turboPlugin,
        },
        rules: {
          "turbo/no-undeclared-env-vars": "warn",
        },
      },
      {
        plugins: {
          onlyWarn,
        },
      },
    ],
  },
  {
    ignores: ["**/dist/**", "**/out-tsc/**", "**/.angular/**", "**/node_modules/**"],
  },
);
