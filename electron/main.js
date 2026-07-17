const path = require("path");
const http = require("http");
const { app, BrowserWindow, dialog } = require("electron");

const PORT = 4317;
const APP_URL = `http://127.0.0.1:${PORT}`;

function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function poll() {
      http
        .get(`${APP_URL}/api/health`, (res) => {
          res.resume();
          if (res.statusCode === 200) resolve();
          else retry();
        })
        .on("error", retry);

      function retry() {
        if (Date.now() > deadline) return reject(new Error("Server did not start in time"));
        setTimeout(poll, 200);
      }
    })();
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    title: "Sarini Bistro POS",
    backgroundColor: "#181614",
  });

  win.loadURL(APP_URL);
}

app.whenReady().then(async () => {
  process.env.SARINI_DATA_DIR = path.join(app.getPath("userData"), "data");
  process.env.PORT = String(PORT);

  // Runs the existing Express app in-process: it serves both the built
  // React client and the /api routes on one port, so the desktop window
  // only ever needs to load one URL — no separate dev servers. Packaged
  // builds ship the server under resources/ (via extraResources) rather
  // than inside the asar, since it needs its own node_modules on disk.
  const serverEntry = app.isPackaged
    ? path.join(process.resourcesPath, "server", "src", "index.js")
    : path.join(__dirname, "..", "server", "src", "index.js");
  require(serverEntry);

  await waitForServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((err) => {
  console.error("Failed to start Sarini Bistro POS:", err);
  dialog.showErrorBox(
    "Sarini Bistro POS failed to start",
    `${err.message}\n\nPlease contact support with this message.`
  );
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
