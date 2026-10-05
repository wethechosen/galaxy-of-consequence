import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    exclude: ["**/node_modules/**", "**/.next/**", "**/vendor/**", "**/.venv*/**"],
    // Password hashing is deliberately expensive and can exceed Vitest's
    // five-second default on constrained Windows hosts and shared CI runners.
    testTimeout: 20_000,
  },
});
