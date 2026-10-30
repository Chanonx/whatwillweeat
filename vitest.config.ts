import { defineConfig } from "vitest/config";

// unit tests เท่านั้น (tests/*.test.mjs เป็น integration test รันด้วย `npm run test:api`)
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
