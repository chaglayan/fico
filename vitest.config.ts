import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts so tests run in plain Node,
// without starting the Cloudflare runtime.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
