const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("laturaivoDesktop", {
  isElectron: true,
  isSteam: true,
  platform: process.platform,
  arch: process.arch,
});
