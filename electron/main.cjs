const path = require("node:path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { findAuthCallback, isAllowedExternalUrl, parseAuthCallback } = require("./deep-link.cjs");
const { installApplicationMenu } = require("./menu.cjs");
const { APP_ORIGIN, installAppProtocol, registerAppScheme } = require("./protocol.cjs");

registerAppScheme();

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

const developmentUrl = process.env.ELECTRON_RENDERER_URL || "";
const isDevelopment = Boolean(developmentUrl);
let mainWindow = null;
let pendingAuthCallback = findAuthCallback(process.argv);

function validatedDevelopmentUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.port !== "5173") {
    throw new Error("ELECTRON_RENDERER_URL must be http://127.0.0.1:5173");
  }
  return url.toString();
}

function isTrustedRendererUrl(value) {
  try {
    const url = new URL(value);
    if (isDevelopment) return url.origin === new URL(developmentUrl).origin;
    return url.origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function isExternalWebUrl(value) {
  return isAllowedExternalUrl(value);
}

function deliverAuthCallback(callback) {
  if (!callback) return;
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isLoading()) {
    pendingAuthCallback = callback;
    return;
  }
  mainWindow.webContents.send("desktop:auth-callback", callback);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow = window;

  window.once("ready-to-show", () => window.show());
  window.webContents.once("did-finish-load", () => {
    const callback = pendingAuthCallback;
    pendingAuthCallback = null;
    deliverAuthCallback(callback);
  });
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalWebUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (isTrustedRendererUrl(url)) return;
    event.preventDefault();
    if (isExternalWebUrl(url)) void shell.openExternal(url);
  });

  if (isDevelopment) {
    await window.loadURL(validatedDevelopmentUrl(developmentUrl));
  } else {
    await window.loadURL(`${APP_ORIGIN}/`);
  }
}

if (hasSingleInstanceLock) app.on("second-instance", (_event, commandLine) => {
  deliverAuthCallback(findAuthCallback(commandLine));
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  deliverAuthCallback(parseAuthCallback(url));
});

ipcMain.handle("desktop:open-external", async (_event, url) => {
  if (!isAllowedExternalUrl(url)) throw new Error("Only secure external URLs are allowed.");
  await shell.openExternal(url);
  return true;
});

if (hasSingleInstanceLock) app.whenReady().then(async () => {
  if (app.isPackaged) app.setAsDefaultProtocolClient("taskflow");
  if (!isDevelopment) {
    await installAppProtocol(path.join(__dirname, "..", "dist"));
  }

  installApplicationMenu({ isDevelopment });
  await createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
