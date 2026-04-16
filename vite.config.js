import fs from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";

const isWebReleaseBuild = process.env.VITE_LATURAIVO_WEB_RELEASE === "1";

const pathExists = async (target) => {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
};

const removeMatchingFiles = async (root, predicate) => {
  if (!(await pathExists(root))) return 0;

  let removed = 0;
  const entries = await fs.readdir(root, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      removed += await removeMatchingFiles(fullPath, predicate);
      return;
    }

    if (predicate(fullPath, entry.name)) {
      await fs.rm(fullPath, { force: true });
      removed += 1;
    }
  }));
  return removed;
};

const shouldSkipPublicAsset = (publicDir, sourcePath) => {
  const relative = path.relative(publicDir, sourcePath);
  if (!relative || relative.startsWith("..")) return false;

  const parts = relative.split(path.sep);
  return parts.some((part) => /^_?backup/i.test(part)) || path.basename(sourcePath) === ".DS_Store";
};

const webReleaseAssetsPlugin = () => {
  let outDir = "";

  return {
    name: "laturaivo-web-release-assets",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const publicDir = path.resolve(process.cwd(), "public");
      if (await pathExists(publicDir)) {
        await fs.cp(publicDir, outDir, {
          recursive: true,
          force: true,
          filter: async (sourcePath) => !shouldSkipPublicAsset(publicDir, sourcePath),
        });
      }

      if (!isWebReleaseBuild) return;

      const webPublicDir = path.resolve(process.cwd(), "public_web");
      if (await pathExists(webPublicDir)) {
        await fs.cp(webPublicDir, outDir, { recursive: true, force: true });
      }

      const removedMovieFiles = await removeMatchingFiles(
        path.join(outDir, "assets", "custom", "story"),
        (_fullPath, fileName) => fileName.toLowerCase().endsWith(".mov")
      );
      const removedMetadataFiles = await removeMatchingFiles(
        outDir,
        (_fullPath, fileName) => fileName === ".DS_Store"
      );

      console.log(
        `[web-release] copied public_web overlays, removed ${removedMovieFiles} MOV files and ${removedMetadataFiles} metadata files from ${path.relative(process.cwd(), outDir)}`
      );
    }
  };
};

// https://vite.dev/config/
export default defineConfig({
  base: "",
  publicDir: false,
  build: {
    // Keep Vite-generated bundles separate from /public/assets to avoid
    // directory name collisions (e.g. "offline 3") in iOS web asset copies.
    assetsDir: "build_assets",
    emptyOutDir: true,
  },
  server: {
    host: "::",
    port: 8080,
    hmr: false,
  },
  plugins: [webReleaseAssetsPlugin()],
  css: {
    postcss: './postcss.config.js',
  },
  resolve: {
    alias: {
      phaser: "phaser/dist/phaser.js",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/test/**/*.{test,spec}.ts"],
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
})
