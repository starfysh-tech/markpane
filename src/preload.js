const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onFileContent: (callback) => {
    ipcRenderer.removeAllListeners('file-content');
    ipcRenderer.on('file-content', (_event, content, filename, is_pdf_mode) => {
      callback(content, filename, is_pdf_mode);
    });
  },

  onError: (callback) => {
    ipcRenderer.removeAllListeners('error');
    ipcRenderer.on('error', (_event, message) => {
      callback(message);
    });
  },

  onFileChanged: (callback) => {
    ipcRenderer.removeAllListeners('file-changed');
    ipcRenderer.on('file-changed', (_event, content, filename) => {
      callback(content, filename);
    });
  },

  openFile: (file_path) => {
    // Validate input type
    if (typeof file_path !== 'string') {
      return;
    }

    ipcRenderer.send('open-file', file_path);
  },

  toggleAlwaysOnTop: () => {
    ipcRenderer.send('toggle-always-on-top');
  },

  onAlwaysOnTopChanged: (callback) => {
    ipcRenderer.removeAllListeners('always-on-top-changed');
    ipcRenderer.on('always-on-top-changed', (_event, is_pinned) => {
      callback(is_pinned);
    });
  },

  onToggleToc: (callback) => {
    ipcRenderer.removeAllListeners('toggle-toc');
    ipcRenderer.on('toggle-toc', () => {
      callback();
    });
  }
});
