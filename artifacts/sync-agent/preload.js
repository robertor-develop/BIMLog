const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bimlog", {
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  startWatching: () => ipcRenderer.invoke("start-watching"),
  stopWatching: () => ipcRenderer.invoke("stop-watching"),
  getWatcherStatus: () => ipcRenderer.invoke("get-watcher-status"),
  getLogs: () => ipcRenderer.invoke("get-logs"),
  onLog: (callback) => {
    ipcRenderer.on("new-log", (_event, entry) => callback(entry));
    return () => ipcRenderer.removeAllListeners("new-log");
  },
});
