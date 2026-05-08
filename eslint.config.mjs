import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "prefer-const": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Project archives and tooling folders not part of runtime app code:
    "node_modules/**",
    ".vercel/**",
    ".contrast-backup-*/**",
    ".rollback_snapshot_*/**",
    "_bak/**",
    "_backups/**",
    "_rollback_snapshots/**",
    "_disabled_routes_*/**",
    "capitalbonds-main/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
