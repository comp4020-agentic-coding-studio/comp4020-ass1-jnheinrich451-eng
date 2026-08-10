import { readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "vite";

// Every .html file in the repo is a page and a build entry, so a multi-page
// hand-written site needs no build config: add pages, link them, ship.
// (Vite's default would build only the root index.html and silently drop the
// rest from dist/ — fine locally, 404s deployed.)
const SKIP = new Set([
  "node_modules",
  "dist",
  "spec",
  "scripts",
  "reflections",
  "reference",
]);

function htmlEntries(dir = "."): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || SKIP.has(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlEntries(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

// `base: "./"` makes built asset URLs relative, so the site works under any
// GitHub Pages path (username.github.io/your-repo/) without further config.
export default defineConfig({
  base: "./",
  // The dev server has been killed twice by its own file watcher: Vite treats a
  // watcher error as fatal, and on Windows attaching to a file that is locked
  // mid-save throws EBUSY. Both times the locked file was a spec document in
  // instructions/ being written while the server ran.
  //
  // Nothing under instructions/ is imported by the build — they are prose the
  // agent reads, not modules — so watching them buys nothing and costs the
  // whole server. reference/ is the same: a saved HTML reference, never built.
  server: {
    watch: { ignored: ["**/instructions/**", "**/reference/**"] },
  },
  build: {
    rollupOptions: {
      input: htmlEntries(),
    },
  },
});
