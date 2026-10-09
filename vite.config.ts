/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiPort = Number(process.env.API_PORT ?? 8787);

export default defineConfig(({ mode }) => {
  // `vite build --mode demo` (see .env.demo): serverless demo with relative asset paths.
  const demo = mode === "demo";
  return {
    plugins: [react()],
    base: demo ? "./" : "/",
    // The demo needs neither the PWA files nor the self-hosted OCR assets.
    publicDir: demo ? false : "public",
    build: { outDir: demo ? "dist-demo" : "dist" },
    server: {
      host: true,
      proxy: {
        "/api": `http://localhost:${apiPort}`,
      },
    },
    test: {
      environment: "node",
    },
  };
});
