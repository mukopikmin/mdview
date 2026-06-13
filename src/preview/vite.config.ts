import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  define: command === "build"
    ? {
      "process.env.NODE_ENV": JSON.stringify("production"),
    }
    : undefined,
  plugins: [react()],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "main.tsx"),
      formats: ["es"],
      fileName: () => "client.js",
    },
    outDir: resolve(__dirname, "dist"),
    rollupOptions: {
      output: {
        entryFileNames: "client.js",
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    testTimeout: 10_000,
  },
}));
