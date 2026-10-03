import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Real counts from the dataset, baked in at build time (the dataset itself stays on the server).
const ds = JSON.parse(readFileSync(new URL("./data/dataset.json", import.meta.url), "utf8"));
const DATASET_META = {
  companies: ds.companies.length as number,
  programs: ds.programs.length as number,
  platforms: ds.platforms.length as number,
  compiledOn: ds.meta.compiledOn as string,
};

// The Worker (wrangler dev, port 8787) serves /api. In `npm run dev` Vite proxies to it.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __DATASET_META__: JSON.stringify(DATASET_META) },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: false },
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
