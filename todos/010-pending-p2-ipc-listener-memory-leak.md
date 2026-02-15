# IPC Event Listener Memory Leak

## Metadata
```yaml
status: pending
priority: p2
issue_id: 010
tags: [code-review, security, memory-leak, electron, ipc]
dependencies: []
```

## Problem Statement

All IPC event listeners use `ipcRenderer.on()` without cleanup. If renderer registers multiple callbacks (e.g., during hot reload in dev mode), listeners accumulate.

**Why it matters:** Memory leaks in development can hide bugs. Multiple invocations of callbacks cause race conditions and unpredictable behavior.

## Findings

**Source:** security-sentinel agent review
**Location:** `/Users/randallnoval/Code/markpane/src/preload.js:4-34`

**Current code:**
```javascript
onFileContent: (callback) => {
  ipcRenderer.on('file-content', (_event, content, filename, is_pdf_mode) => {
    callback(content, filename, is_pdf_mode);
  });
}
```

**Issue:** Each call to `onFileContent()` adds a NEW listener without removing previous ones.

**Impact:**
- Memory leak in development (hot reload)
- Multiple invocations of callback
- Race conditions

## Proposed Solutions

### Option 1: Remove Previous Listeners (Recommended)
**Pros:**
- Prevents leak
- Standard pattern
- No behavior change

**Cons:**
- None

**Effort:** Small (5 minutes)
**Risk:** None

**Implementation:**
```javascript
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

  onAlwaysOnTopChanged: (callback) => {
    ipcRenderer.removeAllListeners('always-on-top-changed');
    ipcRenderer.on('always-on-top-changed', (_event, is_pinned) => {
      callback(is_pinned);
    });
  }
});
```

### Option 2: Use `once()` for One-Time Events
**Pros:**
- Auto-cleanup

**Cons:**
- Doesn't apply to recurring events like `file-changed`
- Partial solution

**Effort:** Small (5 minutes)
**Risk:** Medium (doesn't solve all cases)

## Recommended Action

**Implement Option 1** - Remove all listeners before adding new one.

## Technical Details

**Memory Impact:**
- Each leaked listener: ~1KB + closure
- 100 hot reloads: ~100KB leak

**Files to Modify:**
- `/Users/randallnoval/Code/markpane/src/preload.js` (lines 4-34)

## Acceptance Criteria

- [ ] `removeAllListeners()` called before each `on()`
- [ ] Test: call `onFileContent()` twice, verify only 1 listener
- [ ] Test: hot reload in dev mode, verify no listener accumulation
- [ ] Memory profiling shows no listener leaks

## Work Log

*Findings recorded from security-sentinel agent review on 2025-02-15*

## Resources

- Agent Review: security-sentinel (ae1d9c2)
- Electron IPC: https://www.electronjs.org/docs/latest/api/ipc-renderer
