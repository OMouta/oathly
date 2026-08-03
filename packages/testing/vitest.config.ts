import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Test against the current source, not whatever `dist` happens to hold.
      oathly: fileURLToPath(new URL("../oathly/src/index.ts", import.meta.url)),
    },
  },
});
