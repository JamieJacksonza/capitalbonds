import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Project archives and tooling folders not part of runtime app code:
    "node_modules/**",
    ".contrast-backup-*/**",
    "_bak/**",
    "_backups/**",
    "_rollback_snapshots/**",
    "_disabled_routes_*/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
