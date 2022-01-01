const { app, BrowserWindow } = require('electron');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

const createWindow = () => {
  app.allowRendererProcessReuse = true;
  mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
    width: 800,
    height: 600,
  });
  mainWindow.maximize();

  mainWindow.loadURL(`file://${__dirname}/index.html`);

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  require(`${__dirname}/menu/main_menu.js`);
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});