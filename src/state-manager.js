const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class StateManager {
  constructor() {
    this.state = new Map();
    this.maxEntries = 1000;
    this.stateFile = path.join(app.getPath('userData'), 'toc-state.json');
    this.loadState();
  }

  normalizeKey(filePath) {
    const resolved = path.resolve(filePath);
    try {
      return fs.realpathSync(resolved);  // Resolves symlinks
    } catch {
      return resolved;
    }
  }

  getTocState(filePath) {
    const key = this.normalizeKey(filePath);
    return this.state.get(key) || {};
  }

  setTocState(filePath, tocState) {
    const key = this.normalizeKey(filePath);

    // FIFO eviction
    if (this.state.size >= this.maxEntries && !this.state.has(key)) {
      const firstKey = this.state.keys().next().value;
      this.state.delete(firstKey);
    }

    this.state.set(key, {
      ...tocState,
      lastModified: Date.now()
    });

    this.scheduleSave();
  }

  cleanup() {
    const maxAge = 30 * 24 * 60 * 60 * 1000;  // 30 days
    const now = Date.now();

    for (const [key, value] of this.state.entries()) {
      if (!fs.existsSync(key) || (now - value.lastModified) > maxAge) {
        this.state.delete(key);
      }
    }
  }

  scheduleSave() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.saveState(), 2000);
  }

  saveState() {
    this.cleanup();
    const serialized = Array.from(this.state.entries());
    try {
      fs.writeFileSync(this.stateFile, JSON.stringify(serialized, null, 2));
    } catch (err) {
      console.error('Failed to save TOC state:', err);
    }
  }

  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const data = fs.readFileSync(this.stateFile, 'utf8');
        this.state = new Map(JSON.parse(data));
        this.cleanup();
      }
    } catch (err) {
      console.error('Failed to load TOC state:', err);
      this.state = new Map();
    }
  }
}

module.exports = new StateManager();
