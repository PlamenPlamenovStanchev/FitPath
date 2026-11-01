import { clerkSetup } from "@clerk/testing/cypress";
import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    setupNodeEvents(_on, config) {
      return clerkSetup({ config });
    },
    supportFile: "cypress/support/e2e.ts",
  },
});
