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

  togglePin: () => {
    ipcRenderer.send('toggle-pin');
  },

  onPinStateChanged: (callback) => {
    ipcRenderer.on('pin-state-changed', (_event, is_pinned) => {
      callback(is_pinned);
    });
  },

  openFile: (file_path) => {
    ipcRenderer.send('open-file-request', file_path);
  },

  toggleSearch: () => {
    ipcRenderer.send('toggle-search');
  },

  searchNext: () => {
    ipcRenderer.send('search-next');
  },

  searchPrev: () => {
    ipcRenderer.send('search-prev');
  },

  toggleTOC: () => {
    ipcRenderer.send('toggle-toc');
  },

  onToggleSearch: (callback) => {
    ipcRenderer.on('toggle-search', () => {
      callback();
    });
  },

  onSearchNext: (callback) => {
    ipcRenderer.on('search-next', () => {
      callback();
    });
  },

  onSearchPrev: (callback) => {
    ipcRenderer.on('search-prev', () => {
      callback();
    });
  },

  onToggleTOC: (callback) => {
    ipcRenderer.on('toggle-toc', () => {
      callback();
    });
  },

  setTocVisible: (is_visible) => {
    ipcRenderer.send('set-toc-visible', is_visible);
  },

  getTocVisible: () => {
    return ipcRenderer.invoke('get-toc-visible');
  },

  onFileChanged: (callback) => {
    ipcRenderer.on('file-changed', (_event, content) => {
      callback(content);
    });
  },

  showContextMenu: (data) => {
    ipcRenderer.send('context-menu', data);
  },

  onCopyAsHTML: (callback) => {
    ipcRenderer.on('copy-as-html', () => {
      callback();
    });
  }
});
