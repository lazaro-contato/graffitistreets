import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        // The gallery lives in its own folder rather than as gallery.html, so
        // the built URL is /gallery/ on any static host — no rewrite rules and
        // no host-specific "clean URLs" setting to remember.
        main: resolve(__dirname, "index.html"),
        gallery: resolve(__dirname, "gallery/index.html"),
      },
    },
  },
});
