import { join } from "path";
import { readFile } from "fs/promises";
import { app, BrowserWindow, dialog, ipcMain } from "electron";

const isDev = !app.isPackaged;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    title: "CivilPDF Editor",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      // Primary renderer isolation: contextIsolation + no nodeIntegration.
      // sandbox is false because the preload is an ESM bundle (electron-vite);
      // re-enabling sandbox requires a CJS preload (tracked as hardening).
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

/**
 * Open a native file dialog and return the selected PDF's bytes.
 * The renderer has no fs access (sandboxed), so the main process reads the file.
 */
ipcMain.handle("pdf:open", async () => {
  const result = await dialog.showOpenDialog({
    title: "PDF を開く",
    properties: ["openFile"],
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const buf = await readFile(filePath);
  return {
    name: filePath.split(/[/\\]/).pop() ?? "document.pdf",
    bytes: new Uint8Array(buf),
  };
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
