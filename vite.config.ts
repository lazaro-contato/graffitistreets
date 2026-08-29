import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Read rather than imported, so this needs no JSON module settings in the
// TypeScript config and there is one place the version can come from.
const { version } = JSON.parse(readFileSync("./package.json", "utf8"));

export default defineConfig({
  // Baked at build time. A version read at runtime could disagree with the
  // bundle it is printed next to, which defeats the point of showing it.
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    rollupOptions: {
      input: {
        // The gallery lives in its own folder rather than as gallery.html, so
        // the built URL is /gallery/ on any static host — no rewrite rules and
        // no host-specific "clean URLs" setting to remember.
        main: resolve(import.meta.dirname, "index.html"),
        gallery: resolve(import.meta.dirname, "gallery/index.html"),
      },
    },
  },
});
