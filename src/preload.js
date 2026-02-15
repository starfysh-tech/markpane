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
      console.error('openFile: path must be string');
      return;
    }

    // Validate length (prevent DoS)
    if (file_path.length > 4096) {
      console.error('openFile: path too long');
      return;
    }

    ipcRenderer.send('open-file', file_path);
  },

  toggleAlwaysOnTop: (() => {
    let last_toggle = 0;
    return () => {
      // Rate limit (prevent spam)
      const now = Date.now();
      if (now - last_toggle < 500) {
        return; // Debounce 500ms
      }
      last_toggle = now;

      ipcRenderer.send('toggle-always-on-top');
    };
  })(),

  onAlwaysOnTopChanged: (callback) => {
    ipcRenderer.removeAllListeners('always-on-top-changed');
    ipcRenderer.on('always-on-top-changed', (_event, is_pinned) => {
      callback(is_pinned);
    });
  }
});
