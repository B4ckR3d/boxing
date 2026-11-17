import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * ESLint untuk `@tfn/core` — library domain, bukan aplikasi.
 *
 * Berbeda dari `apps/api`: aturan `no-console` tidak dipasang di sini karena paket ini memang
 * dipanggil dari proses lain dan tidak punya kewenangan memutuskan cara logging aplikasi.
 * Larangan `any` tetap `error` supaya tipe domain tidak melunak saat dipindah.
 */
export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
);
