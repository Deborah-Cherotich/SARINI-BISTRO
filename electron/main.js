const path = require("path");
const http = require("http");
const { app, BrowserWindow } = require("electron");

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
  // only ever needs to load one URL — no separate dev servers.
  require(path.join(__dirname, "..", "server", "src", "index.js"));

  await waitForServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
