const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onFileContent: (callback) => {
    const handler = (_event, content, filename, is_pdf_mode) => {
      callback(content, filename, is_pdf_mode);
    };
    ipcRenderer.on('file-content', handler);
    return () => ipcRenderer.removeListener('file-content', handler);
  },

  onError: (callback) => {
    const handler = (_event, message) => {
      callback(message);
    };
    ipcRenderer.on('error', handler);
    return () => ipcRenderer.removeListener('error', handler);
  },

  onFileChanged: (callback) => {
    const handler = (_event, content, filename) => {
      callback(content, filename);
    };
    ipcRenderer.on('file-changed', handler);
    return () => ipcRenderer.removeListener('file-changed', handler);
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
    if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
      console.error('Invalid settings: must be an object');
      return;
    }

    // Allowlist expected keys
    const allowed_keys = ['theme', 'bodyFont', 'bodyFontSize', 'codeFont', 'codeFontSize', 'font'];
    const validated_settings = {};
    for (const key of Object.keys(settings)) {
      if (allowed_keys.includes(key)) {
        validated_settings[key] = settings[key];
      }
    }

    // Cap serialized size (64KB)
    const json = JSON.stringify(validated_settings);
    if (json.length > 65536) {
      console.error('Settings object too large');
      return;
    }

    ipcRenderer.send('save-settings', validated_settings);
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
    const handler = (_event, is_pinned) => {
      callback(is_pinned);
    };
    ipcRenderer.on('always-on-top-changed', handler);
    return () => ipcRenderer.removeListener('always-on-top-changed', handler);
  },

  closeWindow: () => {
    ipcRenderer.send('close-window');
  },

  quitApp: () => {
    ipcRenderer.send('quit-app');
  }
});
