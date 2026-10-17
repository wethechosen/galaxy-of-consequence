import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    exclude: ["**/node_modules/**", "**/.next/**", "**/vendor/**", "**/.venv*/**"],
    // Deliberately expensive authentication hashes need bounded concurrency
    // and more than 20 seconds when CI shares a two-core build machine.
    maxWorkers: 2,
    testTimeout: 60_000,
  },
});
