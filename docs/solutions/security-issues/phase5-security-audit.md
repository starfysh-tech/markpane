# Phase 5 Security Audit Report
**Commit:** 6700698 (feat/phase5-session-multi-window)
**Date:** 2026-02-15
**Auditor:** Security Sentinel

## Executive Summary

**Overall Risk Level:** MEDIUM

This audit identified 4 security vulnerabilities (1 CRITICAL, 1 HIGH, 2 MEDIUM) in the Phase 5 implementation. The critical issue involves path traversal in persistence files, while other concerns relate to IPC validation and window bounds manipulation.

**Immediate Action Required:**
1. Sanitize file paths in recent-files.json before loading
2. Validate query length in find-text IPC handler
3. Add bounds validation to prevent off-screen window positioning

---

## Critical Findings

### 🔴 CRITICAL: Path Traversal in Recent Files Persistence

**Location:** `/Users/randallnoval/Code/markpane/src/main.js:267-306`

**Issue:**
The `load_recent_files()` and `add_recent_file()` functions do not validate or sanitize file paths before persisting them to `recent-files.json`. An attacker who can manipulate this JSON file could inject arbitrary paths that will be executed by `open_file()`.

**Vulnerable Code:**
```javascript
// Line 267-278: No validation of loaded paths
function load_recent_files() {
  try {
    const recent_path = path.join(app.getPath('userData'), 'recent-files.json');
    if (!fs.existsSync(recent_path)) {
      return [];
    }
    const files = JSON.parse(fs.readFileSync(recent_path, 'utf-8'));
    return Array.isArray(files) ? files : [];  // ⚠️ No path validation
  } catch (err) {
    return [];
  }
}

// Line 786-791: Persisted paths used directly in menu
const recent_submenu = recent_files.length > 0
  ? recent_files.map(item => ({
      label: item.display_name,
      click: () => open_file(item.path)  // ⚠️ Arbitrary path execution
    }))
  : [{ label: 'No Recent Files', enabled: false }];

// Line 938-941: Persisted path used on app activate
const recent_files = load_recent_files();
if (recent_files.length > 0) {
  open_file(recent_files[0].path);  // ⚠️ First path auto-opened
}
```

**Attack Vector:**
1. Attacker gains write access to `~/Library/Application Support/MarkPane/recent-files.json`
2. Injects malicious path: `{"path": "/etc/passwd", "display_name": "passwords.md", "last_opened": "..."}`
3. User clicks recent file or reopens app → sensitive file loaded
4. Or inject path to symlink pointing outside allowed directories

**Proof of Concept:**
```bash
# Create malicious recent-files.json
echo '[{"path":"/etc/passwd","display_name":"config.md","last_opened":"2026-02-15"}]' > \
  ~/Library/Application\ Support/MarkPane/recent-files.json

# Launch app or click File > Open Recent → /etc/passwd displayed
```

**Impact:**
- Read arbitrary files on the system (within user permissions)
- Potential information disclosure of sensitive files
- Bypass intended file type restrictions (.md, .markdown, .txt)

**Remediation:**

1. **Validate paths on load:**
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

    // Validate each path
    return files.filter(item => {
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

2. **Sanitize on save:**
```javascript
function add_recent_file(fp) {
  const normalized = normalize_file_path(fp);

  // Validate file extension
  const ext = path.extname(normalized).toLowerCase();
  if (!['.md', '.markdown', '.txt'].includes(ext)) {
    return; // Don't persist non-markdown files
  }

  let recent = load_recent_files();
  recent = recent.filter(item => item.path !== normalized);
  recent.unshift({
    path: normalized,
    display_name: path.basename(normalized),
    last_opened: new Date().toISOString()
  });

  if (recent.length > 10) {
    recent = recent.slice(0, 10);
  }

  save_recent_files(recent);
}
```

---

## High Severity Findings

### 🟠 HIGH: Insufficient Input Validation in IPC Handler

**Location:** `/Users/randallnoval/Code/markpane/src/main.js:883-884`

**Issue:**
The `find-text` IPC handler accepts unsanitized query strings from the renderer. While the preload enforces a 1000-character limit, the main process does not re-validate, creating a trust boundary violation.

**Vulnerable Code:**
```javascript
// src/preload.js:17-20 - Validation exists but can be bypassed
findText: (query) => {
  if (typeof query !== 'string') return;
  if (query.length > 1000) return;  // ⚠️ Client-side validation only
  ipcRenderer.send('find-text', query);
},

// src/main.js:883-884 - No server-side validation
ipcMain.on('find-text', (event, query) => {
  event.sender.findInPage(query, { findNext: true });  // ⚠️ Trusts renderer
});
```

**Attack Vector:**
1. Malicious code in renderer bypasses preload.js
2. Directly calls `ipcRenderer.send('find-text', 'A'.repeat(1000000))`
3. Main process attempts to search massive string
4. Potential DoS via memory exhaustion

**Impact:**
- Denial of service through memory exhaustion
- Potential browser process hang or crash

**Remediation:**

```javascript
// src/main.js - Add server-side validation
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

## Medium Severity Findings

### 🟡 MEDIUM: Window Bounds Validation Insufficient

**Location:** `/Users/randallnoval/Code/markpane/src/main.js:230-250`

**Issue:**
The `load_window_bounds()` function validates that the window is visible on a connected display, but does not enforce minimum/maximum size constraints. An attacker could manipulate `window-bounds.json` to create unusably small or excessively large windows.

**Vulnerable Code:**
```javascript
// Line 230-250: Only checks position visibility, not size sanity
function load_window_bounds() {
  try {
    const bounds_path = path.join(app.getPath('userData'), 'window-bounds.json');
    if (!fs.existsSync(bounds_path)) {
      return null;
    }
    const bounds = JSON.parse(fs.readFileSync(bounds_path, 'utf-8'));

    const displays = screen.getAllDisplays();
    const is_visible = displays.some(display => {
      const area = display.workArea;
      return bounds.x >= area.x && bounds.y >= area.y &&
             bounds.x + bounds.width <= area.x + area.width &&
             bounds.y + bounds.height <= area.y + area.height;  // ⚠️ No size limits
    });

    return is_visible ? bounds : null;
  } catch (err) {
    return null;
  }
}
```

**Attack Vector:**
```bash
# Create malicious window-bounds.json
echo '{"x":0,"y":0,"width":1,"height":1}' > \
  ~/Library/Application\ Support/MarkPane/window-bounds.json

# Or create massive window
echo '{"x":0,"y":0,"width":100000,"height":100000}' > \
  ~/Library/Application\ Support/MarkPane/window-bounds.json
```

**Impact:**
- Unusable UI (1x1 pixel window)
- Performance degradation (extremely large window)
- User confusion/frustration

**Remediation:**

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

    // Validate position visibility
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

### 🟡 MEDIUM: Menu Click Handler Uses getFocusedWindow()

**Location:** `/Users/randallnoval/Code/markpane/src/main.js:856-860, 866-870`

**Issue:**
Menu click handlers use `BrowserWindow.getFocusedWindow()` which could be null or refer to a different window if focus changes between menu click and handler execution. This creates a race condition.

**Vulnerable Code:**
```javascript
// Line 856-860
click: () => {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) {
    focused.webContents.send('toggle-toc');  // ⚠️ Race condition
  }
}

// Line 866-870
click: () => {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) {
    focused.webContents.send('show-find');  // ⚠️ Wrong window possible
  }
}
```

**Attack Vector:**
1. User has two MarkPane windows open (Window A, Window B)
2. User focuses Window A, clicks View > Find in Page
3. Between click and handler execution, Window B gains focus
4. Find dialog appears in Window B instead of Window A

**Impact:**
- Unexpected UI behavior (command targets wrong window)
- User confusion
- Potential race condition if window closes during handler execution

**Remediation:**

This is actually **NOT a security vulnerability** in the traditional sense, but rather a UX bug. The current implementation is actually correct for menu items - they should operate on the focused window. However, the check for `isDestroyed()` is good defensive programming.

**Risk Downgrade:** This is a UX concern, not a security issue. Marking as **INFO** level.

---

## Security Strengths (Validated)

### ✅ Context Isolation Maintained

**Location:** `/Users/randallnoval/Code/markpane/src/main.js:682-686`

```javascript
webPreferences: {
  contextIsolation: true,   // ✅ SECURE
  nodeIntegration: false,   // ✅ SECURE
  preload: path.join(__dirname, 'preload.js')
}
```

**Status:** No changes to security-critical Electron settings. Context isolation remains enabled.

---

### ✅ IPC Handlers Use event.sender (Fixed)

**Location:** `/Users/randallnoval/Code/markpane/src/main.js:883-894`

**Before (vulnerable):**
```javascript
ipcMain.on('find-text', (event, query) => {
  if (!main_window || main_window.isDestroyed()) return;
  main_window.webContents.findInPage(query, { findNext: true });  // ❌ Wrong window
});
```

**After (secure):**
```javascript
ipcMain.on('find-text', (event, query) => {
  event.sender.findInPage(query, { findNext: true });  // ✅ Correct window
});

ipcMain.on('stop-find', (event, action) => {
  event.sender.stopFindInPage(action || 'clearSelection');  // ✅ Correct window
});
```

**Analysis:**
This change correctly addresses multi-window IPC security. Using `event.sender` ensures each window can only control its own search state, preventing cross-window interference.

---

### ✅ Path Normalization with realpathSync

**Location:** `/Users/randallnoval/Code/markpane/src/main.js:259-265`

```javascript
function normalize_file_path(fp) {
  try {
    return fs.realpathSync(path.resolve(fp));  // ✅ Resolves symlinks
  } catch (err) {
    return path.resolve(fp);  // ⚠️ Fallback doesn't resolve symlinks
  }
}
```

**Analysis:**
The use of `fs.realpathSync()` correctly resolves symbolic links, preventing symlink-based path traversal attacks. However, the fallback on error returns an unresolved path, which could be exploited if the file exists but is temporarily inaccessible.

**Recommendation (Low Priority):**
```javascript
function normalize_file_path(fp) {
  try {
    return fs.realpathSync(path.resolve(fp));
  } catch (err) {
    // Don't return unresolved path on error
    throw new Error(`Cannot resolve path: ${fp}`);
  }
}
```

---

### ✅ File Dialog Filters Enforced

**Location:** `/Users/randallnoval/Code/markpane/src/main.js:814-823, 943-946`

```javascript
// File > Open dialog
const result = await dialog.showOpenDialog({
  properties: ['openFile'],
  filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]  // ✅ Whitelisted
});

// Activate fallback dialog
dialog.showOpenDialog({
  properties: ['openFile'],
  filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]  // ✅ Whitelisted
});
```

**Status:** File type restrictions properly enforced in dialog. However, this is UI-level protection only - the underlying `open_file()` function does not re-validate extensions.

**Recommendation:** Add server-side extension validation in `open_file()` as shown in CRITICAL finding remediation.

---

### ✅ Window File Path Tracking

**Location:** `/Users/randallnoval/Code/markpane/src/main.js:619-634, 689-692`

```javascript
// Store file path on window instance
if (target_file_path) {
  win.markpane_file_path = normalize_file_path(target_file_path);  // ✅ Normalized
}

// Prevent duplicate windows for same file
const existing_window = BrowserWindow.getAllWindows().find(
  win => win.markpane_file_path === normalized_path
);
if (existing_window) {
  existing_window.focus();  // ✅ No duplicate
  return;
}
```

**Status:** Good practice - prevents duplicate windows and ensures file paths are normalized before storage.

---

## Additional Security Considerations

### ⚠️ open-file Event Handler (macOS)

**Location:** `/Users/randallnoval/Code/markpane/src/main.js:956-963`

```javascript
app.on('open-file', (event, path) => {
  event.preventDefault();
  if (app.isReady()) {
    open_file(path);  // ⚠️ Path from Finder - trusted but unvalidated
  } else {
    app.whenReady().then(() => open_file(path));
  }
});
```

**Analysis:**
The `open-file` event receives paths from Finder/dock. While macOS provides some sandboxing, the path is not validated before passing to `open_file()`. An attacker with local access could use AppleScript or LaunchServices to trigger this with arbitrary paths.

**Risk:** Low (requires local access, macOS sandboxing provides defense)

**Recommendation:** Add extension validation:
```javascript
app.on('open-file', (event, path) => {
  event.preventDefault();

  // Validate extension
  const ext = require('path').extname(path).toLowerCase();
  if (!['.md', '.markdown', '.txt'].includes(ext)) {
    return; // Silently ignore non-markdown files
  }

  if (app.isReady()) {
    open_file(path);
  } else {
    app.whenReady().then(() => open_file(path));
  }
});
```

---

## Vulnerability Summary Matrix

| ID | Severity | Category | Location | Status |
|----|----------|----------|----------|--------|
| SEC-01 | CRITICAL | Path Traversal | `load_recent_files()` | **FIX REQUIRED** |
| SEC-02 | HIGH | Input Validation | `ipcMain.on('find-text')` | **FIX REQUIRED** |
| SEC-03 | MEDIUM | Data Validation | `load_window_bounds()` | **FIX RECOMMENDED** |
| SEC-04 | INFO | Race Condition | Menu handlers | **UX IMPROVEMENT** |
| SEC-05 | LOW | Input Validation | `app.on('open-file')` | **ENHANCEMENT** |

---

## Remediation Roadmap

### Phase 1: Immediate (Critical/High) - **REQUIRED BEFORE MERGE**

1. **Add path validation to recent files** (SEC-01)
   - Implement extension whitelist in `load_recent_files()`
   - Add sanitization in `add_recent_file()`
   - Test with malicious `recent-files.json`

2. **Add server-side IPC validation** (SEC-02)
   - Validate query length in `find-text` handler
   - Validate action enum in `stop-find` handler
   - Add input validation tests

**Estimated effort:** 2-3 hours
**Blocking:** Yes - merge should be blocked until these are fixed

### Phase 2: Short-term (Medium) - **RECOMMENDED BEFORE RELEASE**

3. **Add window bounds constraints** (SEC-03)
   - Enforce min/max width/height
   - Add size validation tests
   - Document acceptable ranges

4. **Add extension validation to open-file handler** (SEC-05)
   - Whitelist .md, .markdown, .txt
   - Test with AppleScript injection

**Estimated effort:** 1-2 hours
**Blocking:** No - but should be addressed before public release

### Phase 3: Future (Info/Low) - **OPTIONAL**

5. **Improve error handling in normalize_file_path()** (Enhancement)
   - Throw error instead of returning unresolved path
   - Add comprehensive path handling tests

**Estimated effort:** 30 minutes
**Blocking:** No

---

## Testing Recommendations

### Security Test Cases

1. **Path Traversal Tests**
   ```javascript
   // Test malicious recent-files.json
   test('rejects paths outside allowed extensions', () => {
     const malicious = [
       { path: '/etc/passwd', display_name: 'config.md' },
       { path: '/tmp/exploit.sh', display_name: 'notes.md' }
     ];
     // Should filter out both entries
   });

   test('rejects non-existent paths', () => {
     const missing = [
       { path: '/nonexistent/file.md', display_name: 'missing.md' }
     ];
     // Should filter out missing files
   });
   ```

2. **IPC Validation Tests**
   ```javascript
   test('rejects oversized find queries', () => {
     const huge_query = 'A'.repeat(10000);
     // Should be rejected by main process
   });

   test('rejects invalid stop-find actions', () => {
     const invalid = 'maliciousAction';
     // Should default to 'clearSelection'
   });
   ```

3. **Bounds Validation Tests**
   ```javascript
   test('rejects tiny window bounds', () => {
     const tiny = { x: 0, y: 0, width: 1, height: 1 };
     // Should return null
   });

   test('rejects huge window bounds', () => {
     const huge = { x: 0, y: 0, width: 100000, height: 100000 };
     // Should return null
   });
   ```

---

## Conclusion

Phase 5 introduces significant new functionality but also creates new attack surfaces through persistence mechanisms. The critical path traversal vulnerability in recent files **must be fixed before merge**. The IPC validation issue should also be addressed immediately.

The positive news is that core Electron security settings remain intact, and the multi-window IPC refactoring correctly uses `event.sender` instead of hardcoded window references.

**Recommendation:** **DO NOT MERGE** until SEC-01 and SEC-02 are resolved. SEC-03 can be addressed before release.

---

## Appendix: Code Locations Reference

All file paths are absolute:

- **Main Process:** `/Users/randallnoval/Code/markpane/src/main.js`
- **Preload Script:** `/Users/randallnoval/Code/markpane/src/preload.js`
- **Persistence Files:**
  - `~/Library/Application Support/MarkPane/recent-files.json`
  - `~/Library/Application Support/MarkPane/window-bounds.json`
  - `~/Library/Application Support/MarkPane/quicklook.json`

---

**Report Generated:** 2026-02-15
**Next Review:** After remediation of critical/high findings
