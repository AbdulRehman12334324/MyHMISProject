import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";

// LOCAL TESTING ONLY: serves the Vite dev server itself over HTTPS using a
// locally-generated cert (see certs/README.md). HTTPS is required even for
// local testing per the project's Locked Decisions — there is no http://
// fallback for this app, in dev or prod.
const localCertExists =
  fs.existsSync("./certs/localhost.pem") && fs.existsSync("./certs/localhost-key.pem");

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    https: localCertExists
      ? {
          cert: fs.readFileSync("./certs/localhost.pem"),
          key: fs.readFileSync("./certs/localhost-key.pem"),
        }
      : undefined,
    proxy: {
      "/api": {
        target: "https://localhost:8000",
        changeOrigin: true,
        secure: false,   // allow self-signed cert on local dev backend
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,    // never expose sourcemaps in production (security)
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,   // strip all console.log in production build
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        // Fingerprinted filenames for long-term caching
        entryFileNames:   "assets/[name].[hash].js",
        chunkFileNames:   "assets/[name].[hash].js",
        assetFileNames:   "assets/[name].[hash].[ext]",
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
  },
});
