const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "taskflowDesktop",
  Object.freeze({
    isDesktop: true,
    platform: process.platform,
    openExternal: (url) => ipcRenderer.invoke("desktop:open-external", url),
    onAuthCallback: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, payload) => callback(Object.freeze({ ...payload }));
      ipcRenderer.on("desktop:auth-callback", listener);
      return () => ipcRenderer.removeListener("desktop:auth-callback", listener);
    },
  }),
);
