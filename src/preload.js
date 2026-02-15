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
    ipcRenderer.removeAllListeners('found-in-page');
    ipcRenderer.on('found-in-page', (_event, result) => {
      callback(result);
    });
  }
});
