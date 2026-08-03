import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      oathly: fileURLToPath(new URL("../oathly/src/index.ts", import.meta.url)),
      "@oathly/testing": fileURLToPath(
        new URL("../testing/src/index.ts", import.meta.url),
      ),
    },
  },
});
