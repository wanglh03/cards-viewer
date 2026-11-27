import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const localPageData = {
  name: "local-page-data",
  configureServer(server: any) {
    const directory = process.env.CARDS_JSON_DIR;
    if (!directory) return;
    server.middlewares.use(
      async (request: any, response: any, next: () => void) => {
        const match = request.url
          ?.split("?")[0]
          .match(
            /^\/json\/(gallery|bin|withdrawal|my|wallet|collection|credit|myissuers)\.json$/,
          );
        if (!match) return next();
        try {
          const body = await readFile(resolve(directory, `${match[1]}.json`));
          response.setHeader(
            "Content-Type",
            "application/json; charset=utf-8",
          );
          response.end(body);
        } catch {
          response.statusCode = 404;
          response.end("Generated page data not found");
        }
      },
    );
  },
};

export default defineConfig({
  plugins: [localPageData, tailwindcss(), react()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssMinify: "esbuild",
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 5173,
    proxy: {
      "/docs-data": {
        target: "https://cards-cdn.gtbro.vip",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/docs-data/, "/docs"),
      },
      "/export-logos": {
        target: "https://cards-cdn.gtbro.vip",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/export-logos\//, "/issuers/logo/"),
      },
      "/json": {
        target: "https://cards-cdn.gtbro.vip",
        changeOrigin: true,
      },
    },
  },
});
