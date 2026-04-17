const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File dialogs
  openImage: (multiple = false) => ipcRenderer.invoke('dialog:openImage', multiple),
  saveImage: (opts) => ipcRenderer.invoke('dialog:saveImage', opts),

  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
});