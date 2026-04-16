const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const isSmokeTest = process.argv.includes("--smoke-test");
const appRoot = path.resolve(__dirname, "..");
const indexPath = path.join(appRoot, "dist-steam", "index.html");

const createWindow = () => {
  if (!fs.existsSync(indexPath)) {
    console.error(`[steam-desktop] Missing ${indexPath}. Run npm run build:steam first.`);
    app.exit(1);
    return null;
  }

  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    fullscreenable: true,
    show: !isSmokeTest,
    title: "Laturaivo",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    const currentUrl = window.webContents.getURL();
    if (url === currentUrl || url.startsWith("file://")) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
  });

  window.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11" || (input.alt && input.key === "Enter")) {
      event.preventDefault();
      window.setFullScreen(!window.isFullScreen());
    }
  });

  window.webContents.once("did-finish-load", () => {
    if (isSmokeTest) {
      console.log("[steam-desktop] loaded dist-steam/index.html");
      app.exit(0);
    }
  });

  window.webContents.once("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
    console.error(`[steam-desktop] load failed ${errorCode}: ${errorDescription} (${validatedUrl})`);
    if (isSmokeTest) app.exit(1);
  });

  void window.loadFile(indexPath);
  return window;
};

app.setName("Laturaivo");
app.setAppUserModelId("fi.ubercreative.laturaivo");

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
