const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

let tray = null;
let settingsWindow = null;
let watcher = null;
let isWatching = false;

const CONFIG_PATH = path.join(os.homedir(), ".bimlog-sync-agent.json");
const LOG_PATH    = path.join(os.homedir(), "bimlog-sync-agent.log");

function loadSettings() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    }
  } catch (error) {
    console.warn("[sync-agent] Could not load settings:", error instanceof Error ? error.message : String(error));
  }
  return { apiToken: "", projectId: "", baseUrl: "https://bimlog.app", watchFolder: "" };
}

function saveSettings(settings) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2), "utf8");
}

let inMemoryLogs = [];

function appendLog(entry) {
  const line = `[${entry.timestamp}] [${entry.status.toUpperCase()}] ${entry.fileName} — ${entry.message}\n`;
  try {
    fs.appendFileSync(LOG_PATH, line, "utf8");
  } catch (error) {
    console.warn("[sync-agent] Could not write log:", error instanceof Error ? error.message : String(error));
  }
  inMemoryLogs.unshift(entry);
  if (inMemoryLogs.length > 200) inMemoryLogs = inMemoryLogs.slice(0, 200);
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("new-log", entry);
  }
}

async function validateFile(settings, fileName) {
  const url = `${settings.baseUrl.replace(/\/$/, "")}/api/v1/projects/${settings.projectId}/files`;
  const https = url.startsWith("https") ? require("https") : require("http");

  return new Promise((resolve) => {
    const body = JSON.stringify({ name: fileName, originalName: fileName });
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "Authorization": `Bearer ${settings.apiToken}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 200 || res.statusCode === 201) {
            resolve({ valid: true, message: "File name is valid and accepted." });
          } else {
            const details = json?.details;
            let reason = "File rejected by naming convention.";
            if (Array.isArray(details) && details.length > 0) {
              reason = details.map(d => d.message || d.field).join("; ");
            } else if (json?.message) {
              reason = json.message;
            }
            resolve({ valid: false, message: reason });
          }
        } catch (_) {
          resolve({ valid: false, message: `Unexpected response (status ${res.statusCode}).` });
        }
      });
    });

    req.on("error", (err) => {
      resolve({ valid: false, message: `Network error: ${err.message}` });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ valid: false, message: "Request timed out." });
    });

    req.write(body);
    req.end();
  });
}

function showNotification(title, body, urgency) {
  if (!Notification.isSupported()) return;
  new Notification({ title, body, urgency: urgency || "normal" }).show();
}

function startWatcher() {
  const settings = loadSettings();
  if (!settings.watchFolder || !settings.apiToken || !settings.projectId) {
    return { started: false, error: "Missing API token, project ID, or watch folder." };
  }
  if (!fs.existsSync(settings.watchFolder)) {
    return { started: false, error: "Watch folder does not exist." };
  }
  if (watcher) {
    watcher.close();
    watcher = null;
  }

  const chokidar = require("chokidar");
  watcher = chokidar.watch(settings.watchFolder, {
    ignoreInitial: true,
    depth: 0,
    awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 100 },
  });

  watcher.on("add", async (filePath) => {
    const fileName = path.basename(filePath);
    if (fileName.startsWith(".")) return;

    const result = await validateFile(settings, fileName);
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      fileName,
      status: result.valid ? "valid" : "rejected",
      message: result.message,
    };

    appendLog(entry);

    if (result.valid) {
      showNotification("BIMLog — File Accepted", `${fileName}\n${result.message}`, "normal");
    } else {
      showNotification("BIMLog — File Rejected", `${fileName}\n${result.message}`, "critical");
    }

    updateTrayMenu();
  });

  watcher.on("error", (err) => {
    appendLog({
      timestamp: new Date().toISOString(),
      fileName: "—",
      status: "error",
      message: `Watcher error: ${err.message}`,
    });
  });

  isWatching = true;
  updateTrayMenu();
  return { started: true };
}

function stopWatcher() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  isWatching = false;
  updateTrayMenu();
  return { stopped: true };
}

function createTrayIcon() {
  const size = 16;
  const canvas = nativeImage.createEmpty();
  const iconPath = path.join(__dirname, "icon.png");
  if (fs.existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath).resize({ width: size, height: size });
  }
  return canvas;
}

function updateTrayMenu() {
  if (!tray) return;
  const statusLabel = isWatching ? "Watching — active" : "Stopped";
  const menu = Menu.buildFromTemplate([
    { label: "BIMLog Sync Agent", enabled: false },
    { label: `Status: ${statusLabel}`, enabled: false },
    { type: "separator" },
    { label: "Open Settings", click: openSettings },
    { type: "separator" },
    {
      label: isWatching ? "Stop Watching" : "Start Watching",
      click: () => {
        if (isWatching) { stopWatcher(); }
        else { startWatcher(); }
      },
    },
    { type: "separator" },
    { label: "Quit BIMLog Sync Agent", click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(`BIMLog Sync Agent — ${statusLabel}`);
}

function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 560,
    height: 680,
    title: "BIMLog Sync Agent — Settings",
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.loadFile("settings.html");
  settingsWindow.on("closed", () => { settingsWindow = null; });
}

app.whenReady().then(() => {
  app.setName("BIMLog Sync Agent");

  const iconPath = path.join(__dirname, "icon.png");
  let trayImage;
  if (fs.existsSync(iconPath)) {
    trayImage = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } else {
    trayImage = nativeImage.createEmpty();
  }

  tray = new Tray(trayImage);
  tray.setToolTip("BIMLog Sync Agent");
  tray.on("click", openSettings);
  updateTrayMenu();
  openSettings();
});

app.on("window-all-closed", (e) => {
  e.preventDefault();
});

ipcMain.handle("save-settings", (_event, settings) => {
  saveSettings(settings);
  if (isWatching) {
    stopWatcher();
    startWatcher();
  }
  return { ok: true };
});

ipcMain.handle("load-settings", () => loadSettings());

ipcMain.handle("start-watching", () => startWatcher());

ipcMain.handle("stop-watching", () => stopWatcher());

ipcMain.handle("get-watcher-status", () => ({ isWatching }));

ipcMain.handle("get-logs", () => inMemoryLogs);
