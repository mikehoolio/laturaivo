import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist-steam");
const desktopDir = path.join(root, "desktop");
const stageDir = path.join(root, "release", "steam", "LaturaivoSteamStage");

const assertExists = async (target, label) => {
  try {
    await fs.access(target);
  } catch {
    throw new Error(`${label} is missing at ${target}. Run npm run build:steam first.`);
  }
};

await assertExists(path.join(distDir, "index.html"), "Steam web build");
await assertExists(path.join(desktopDir, "main.cjs"), "Electron main file");
await assertExists(path.join(desktopDir, "preload.cjs"), "Electron preload file");

await fs.rm(stageDir, { recursive: true, force: true });
await fs.mkdir(stageDir, { recursive: true });
await fs.cp(distDir, path.join(stageDir, "dist-steam"), { recursive: true });
await fs.cp(desktopDir, path.join(stageDir, "desktop"), { recursive: true });

const packageJson = {
  name: "laturaivo-steam",
  version: "1.0.0",
  private: true,
  main: "desktop/main.cjs",
};

await fs.writeFile(
  path.join(stageDir, "package.json"),
  `${JSON.stringify(packageJson, null, 2)}\n`
);

console.log(`[steam-stage] staged ${path.relative(root, stageDir)}`);
