const { app, BrowserWindow } = require("electron");
const { startServer } = require("../server");

let mainWindow = null;
let serverHandle = null;

async function createMainWindow() {
  const { server, url } = await startServer({
    port: 0,
    host: "127.0.0.1",
  });

  serverHandle = server;

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 980,
    minWidth: 1100,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: "#f4f0e8",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(url);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  if (!serverHandle) {
    return;
  }

  await new Promise((resolve) => {
    serverHandle.close(() => resolve());
  });
  serverHandle = null;
});
