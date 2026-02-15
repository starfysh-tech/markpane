# Phase 5 Security Fixes - Required Changes

## Status: 🔴 BLOCKING - Do Not Merge

**Branch:** feat/phase5-session-multi-window
**Commit:** 6700698

---

## Critical Fixes Required

### 1. Path Traversal in Recent Files (CRITICAL)

**File:** `/Users/randallnoval/Code/markpane/src/main.js`

**Lines to modify:** 267-278 (load_recent_files)

**Current Code:**
```javascript
function load_recent_files() {
  try {
    const recent_path = path.join(app.getPath('userData'), 'recent-files.json');
    if (!fs.existsSync(recent_path)) {
      return [];
    }
    const files = JSON.parse(fs.readFileSync(recent_path, 'utf-8'));
    return Array.isArray(files) ? files : [];
  } catch (err) {
    return [];
  }
}
```

**Fixed Code:**
```javascript
function load_recent_files() {
  try {
    const recent_path = path.join(app.getPath('userData'), 'recent-files.json');
    if (!fs.existsSync(recent_path)) {
      return [];
    }
    const files = JSON.parse(fs.readFileSync(recent_path, 'utf-8'));
    if (!Array.isArray(files)) {
      return [];
    }

    // Validate each path before returning
    return files.filter(item => {
      // Check structure
      if (!item.path || typeof item.path !== 'string') {
        return false;
      }
      try {
        // Resolve symlinks and validate path exists
        const real_path = fs.realpathSync(item.path);
        // Verify file extension (defense in depth)
        const ext = path.extname(real_path).toLowerCase();
        return ['.md', '.markdown', '.txt'].includes(ext);
      } catch (err) {
        // Path doesn't exist or not accessible
        return false;
      }
    });
  } catch (err) {
    return [];
  }
}
```

---

**Lines to modify:** 286-306 (add_recent_file)

**Current Code:**
```javascript
function add_recent_file(fp) {
  const normalized = normalize_file_path(fp);
  let recent = load_recent_files();

  // Remove duplicates
  recent = recent.filter(item => item.path !== normalized);

  // Add to front
  recent.unshift({
    path: normalized,
    display_name: path.basename(normalized),
    last_opened: new Date().toISOString()
  });

  // Cap at 10
  if (recent.length > 10) {
    recent = recent.slice(0, 10);
  }

  save_recent_files(recent);
}
```

**Fixed Code:**
```javascript
function add_recent_file(fp) {
  const normalized = normalize_file_path(fp);

  // Validate file extension before adding
  const ext = path.extname(normalized).toLowerCase();
  if (!['.md', '.markdown', '.txt'].includes(ext)) {
    return; // Don't persist non-markdown files
  }

  let recent = load_recent_files();

  // Remove duplicates
  recent = recent.filter(item => item.path !== normalized);

  // Add to front
  recent.unshift({
    path: normalized,
    display_name: path.basename(normalized),
    last_opened: new Date().toISOString()
  });

  // Cap at 10
  if (recent.length > 10) {
    recent = recent.slice(0, 10);
  }

  save_recent_files(recent);
}
```

---

### 2. IPC Input Validation (HIGH)

**File:** `/Users/randallnoval/Code/markpane/src/main.js`

**Lines to modify:** 883-889

**Current Code:**
```javascript
// Find-in-page IPC handlers
ipcMain.on('find-text', (event, query) => {
  event.sender.findInPage(query, { findNext: true });
});

ipcMain.on('stop-find', (event, action) => {
  event.sender.stopFindInPage(action || 'clearSelection');
});
```

**Fixed Code:**
```javascript
// Find-in-page IPC handlers
ipcMain.on('find-text', (event, query) => {
  // Defense in depth: re-validate in main process
  if (typeof query !== 'string' || query.length === 0 || query.length > 1000) {
    console.warn('Invalid find-text query rejected');
    return;
  }
  event.sender.findInPage(query, { findNext: true });
});

ipcMain.on('stop-find', (event, action) => {
  // Validate action parameter
  const valid_actions = ['clearSelection', 'keepSelection', 'activateSelection'];
  if (action && !valid_actions.includes(action)) {
    action = 'clearSelection'; // Safe default
  }
  event.sender.stopFindInPage(action || 'clearSelection');
});
```

---

## Recommended Fixes (Should Address Before Release)

### 3. Window Bounds Validation (MEDIUM)

**File:** `/Users/randallnoval/Code/markpane/src/main.js`

**Lines to modify:** 230-250

**Current Code:**
```javascript
function load_window_bounds() {
  try {
    const bounds_path = path.join(app.getPath('userData'), 'window-bounds.json');
    if (!fs.existsSync(bounds_path)) {
      return null;
    }
    const bounds = JSON.parse(fs.readFileSync(bounds_path, 'utf-8'));

    // Validate bounds against connected displays
    const displays = screen.getAllDisplays();
    const is_visible = displays.some(display => {
      const area = display.workArea;
      return bounds.x >= area.x && bounds.y >= area.y &&
             bounds.x + bounds.width <= area.x + area.width &&
             bounds.y + bounds.height <= area.y + area.height;
    });

    return is_visible ? bounds : null;
  } catch (err) {
    return null;
  }
}
```

**Fixed Code:**
```javascript
function load_window_bounds() {
  try {
    const bounds_path = path.join(app.getPath('userData'), 'window-bounds.json');
    if (!fs.existsSync(bounds_path)) {
      return null;
    }
    const bounds = JSON.parse(fs.readFileSync(bounds_path, 'utf-8'));

    // Validate bounds structure
    if (typeof bounds.x !== 'number' || typeof bounds.y !== 'number' ||
        typeof bounds.width !== 'number' || typeof bounds.height !== 'number') {
      return null;
    }

    // Enforce size constraints
    const MIN_WIDTH = 400;
    const MIN_HEIGHT = 300;
    const MAX_WIDTH = 5000;
    const MAX_HEIGHT = 5000;

    if (bounds.width < MIN_WIDTH || bounds.width > MAX_WIDTH ||
        bounds.height < MIN_HEIGHT || bounds.height > MAX_HEIGHT) {
      return null; // Reject invalid sizes
    }

    // Validate bounds against connected displays
    const displays = screen.getAllDisplays();
    const is_visible = displays.some(display => {
      const area = display.workArea;
      return bounds.x >= area.x && bounds.y >= area.y &&
             bounds.x + bounds.width <= area.x + area.width &&
             bounds.y + bounds.height <= area.y + area.height;
    });

    return is_visible ? bounds : null;
  } catch (err) {
    return null;
  }
}
```

---

### 4. open-file Handler Extension Validation (LOW)

**File:** `/Users/randallnoval/Code/markpane/src/main.js`

**Lines to modify:** 956-963

**Current Code:**
```javascript
// macOS: handle files opened from Finder/dock
app.on('open-file', (event, path) => {
  event.preventDefault();
  if (app.isReady()) {
    open_file(path);
  } else {
    app.whenReady().then(() => open_file(path));
  }
});
```

**Fixed Code:**
```javascript
// macOS: handle files opened from Finder/dock
app.on('open-file', (event, file_path) => {
  event.preventDefault();

  // Validate extension
  const ext = path.extname(file_path).toLowerCase();
  if (!['.md', '.markdown', '.txt'].includes(ext)) {
    return; // Silently ignore non-markdown files
  }

  if (app.isReady()) {
    open_file(file_path);
  } else {
    app.whenReady().then(() => open_file(file_path));
  }
});
```

---

## Verification Steps

After applying fixes, verify:

1. **Recent Files Path Validation:**
   ```bash
   # Create malicious recent-files.json
   echo '[{"path":"/etc/passwd","display_name":"test.md","last_opened":"2026-02-15"}]' > \
     ~/Library/Application\ Support/MarkPane/recent-files.json

   # Launch app - should ignore the malicious entry
   yarn start
   ```

2. **IPC Query Validation:**
   ```javascript
   // In renderer console (should be rejected):
   window.electronAPI.findText('A'.repeat(10000));
   ```

3. **Window Bounds Validation:**
   ```bash
   # Create malicious window-bounds.json
   echo '{"x":0,"y":0,"width":1,"height":1}' > \
     ~/Library/Application\ Support/MarkPane/window-bounds.json

   # Launch app - should use default bounds instead
   yarn start
   ```

4. **File Extension Validation:**
   ```bash
   # Try opening non-markdown file via Finder
   # Should be rejected silently
   ```

---

## Summary

- **Critical fixes:** 2 (recent files validation, IPC validation)
- **Recommended fixes:** 2 (bounds validation, open-file validation)
- **Files modified:** 1 (src/main.js)
- **Lines of code changed:** ~40 lines total

**Merge Blocker:** Yes - fixes #1 and #2 are required before merge
**Test Coverage:** Manual verification steps provided above
**Regression Risk:** Low - changes are additive (validation only)

---

## Questions?

1. Should we add automated tests for these security validations?
2. Should we log security rejections for debugging?
3. Should we show user-facing errors when malicious files are detected?

---

**Generated:** 2026-02-15
**Status:** Awaiting implementation
