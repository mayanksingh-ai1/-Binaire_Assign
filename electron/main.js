const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';



let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,          // Custom titlebar
    titleBarStyle: 'hidden',
    backgroundColor: '#0f0f0f',
    icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC Handlers ────────────────────────────────────────────────

// Open image file(s) dialog
ipcMain.handle('dialog:openImage', async (_, multiple = false) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Image',
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
  });
  if (result.canceled) return null;
  // Return base64 of each file
  const files = result.filePaths.map((fp) => {
    const data = fs.readFileSync(fp);
    const ext = path.extname(fp).slice(1).toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
    return {
      name: path.basename(fp),
      dataUrl: `data:${mime};base64,${data.toString('base64')}`,
    };
  });
  return multiple ? files : files[0];
});

// Save image to disk
ipcMain.handle('dialog:saveImage', async (_, { dataUrl, defaultName, format }) => {
  const ext = format === 'png' ? 'png' : 'jpg';
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Image',
    defaultPath: `${defaultName || 'image'}.${ext}`,
    filters: [
      { name: 'PNG Image', extensions: ['png'] },
      { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
    ],
  });
  if (result.canceled || !result.filePath) return { success: false };
  // Convert dataUrl to buffer and write
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  fs.writeFileSync(result.filePath, buffer);
  return { success: true, filePath: result.filePath };
});

// Window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());