const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onFileContent: (callback) => {
    ipcRenderer.on('file-content', (_event, content, filename, is_pdf_mode) => {
      callback(content, filename, is_pdf_mode);
    });
  },

  onError: (callback) => {
    ipcRenderer.on('error', (_event, message) => {
      callback(message);
    });
  },

  // Find-in-page APIs
  findText: (query) => {
    if (typeof query !== 'string') return;
    if (query.length > 1000) return;
    ipcRenderer.send('find-text', query);
  },

  stopFind: (action) => {
    ipcRenderer.send('stop-find', action);
  },

  onFoundInPage: (callback) => {
    const handler = (_event, result) => {
      callback(result);
    };
    ipcRenderer.on('found-in-page', handler);
    // Return cleanup function for caller to use if needed
    return () => ipcRenderer.removeListener('found-in-page', handler);
  },

  onToggleToc: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('toggle-toc', handler);
    return () => ipcRenderer.removeListener('toggle-toc', handler);
  },

  onShowFind: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('show-find', handler);
    return () => ipcRenderer.removeListener('show-find', handler);
  },

  onToggleSettings: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('toggle-settings', handler);
    return () => ipcRenderer.removeListener('toggle-settings', handler);
  },

  // Settings APIs
  onSettings: (callback) => {
    const handler = (_event, settings) => callback(settings);
    ipcRenderer.on('settings', handler);
    return () => ipcRenderer.removeListener('settings', handler);
  },

  onSettingsChanged: (callback) => {
    const handler = (_event, settings) => callback(settings);
    ipcRenderer.on('settings-changed', handler);
    return () => ipcRenderer.removeListener('settings-changed', handler);
  },

  onSystemFonts: (callback) => {
    const handler = (_event, fonts) => callback(fonts);
    ipcRenderer.on('system-fonts', handler);
    return () => ipcRenderer.removeListener('system-fonts', handler);
  },

  saveSettings: (settings) => {
    ipcRenderer.send('save-settings', settings);
  },

  closeWindow: () => {
    ipcRenderer.send('close-window');
  },

  quitApp: () => {
    ipcRenderer.send('quit-app');
  }
});
