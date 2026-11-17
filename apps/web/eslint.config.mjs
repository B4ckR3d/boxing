import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      // NOTE: "react/no-danger" was removed because eslint-config-next 16 does not register the
      // `react` plugin namespace, which made the whole config fail before linting a single file
      // ("could not find plugin react"). The intent is preserved below as a plain no-restricted-syntax
      // check, which needs no plugin. `dangerouslySetInnerHTML` must never appear in src/.
      "no-restricted-syntax": [
        "error",
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message: "dangerouslySetInnerHTML is banned: render trusted React nodes instead of raw HTML.",
        },
      ],
    },
  },
  {
    files: ["**/*.cjs"],
    rules: {
      // Ad-hoc Playwright verification probes use CommonJS on purpose (run with plain `node`).
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**", "playwright-report/**", "test-results/**"]),
]);
