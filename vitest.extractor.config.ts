import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Keep handler tests outside the app's RPC compilation; all network/database I/O is mocked.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/extractor-*.test.ts"] },
});