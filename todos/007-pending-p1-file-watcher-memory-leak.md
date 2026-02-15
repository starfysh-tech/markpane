# File Watcher Not Cleaned on Window Destruction

## Metadata
```yaml
status: pending
priority: p1
issue_id: 007
tags: [code-review, performance, memory-leak, electron]
dependencies: []
```

## Problem Statement

File watcher is cleaned up in `window-all-closed` but not in the `closed` event handler. If a window is destroyed without closing all windows (multi-window scenario), the watcher persists as an orphan.

**Why it matters:** Memory leaks accumulate over time and can crash the app. Orphaned file watchers continue to fire events to destroyed windows, wasting resources.

## Findings

**Source:** performance-oracle agent review
**Location:** `/Users/randallnoval/Code/markpane/src/main.js:643-650, 814-818`

**Current code:**
```javascript
// Line 643: Window closed handler
main_window.on('closed', () => {
  main_window = null;
  // ❌ Missing: stop_file_watcher()
});

// Line 647: File watcher started
if (!is_pdf_mode) {
  start_file_watcher();
}

// Line 814: Watcher only stopped when ALL windows closed
app.on('window-all-closed', () => {
  stop_file_watcher();  // ✅ Called here
  globalShortcut.unregisterAll();
  app.quit();
});
```

**Issue:** If `main_window` is destroyed (e.g., user closes specific window in multi-window app), watcher continues running and tries to send IPC to destroyed window.

## Proposed Solutions

### Option 1: Stop Watcher on Window Close (Recommended)
**Pros:**
- Fixes memory leak immediately
- Aligns watcher lifecycle with window lifecycle
- Single line change

**Cons:**
- None

**Effort:** Tiny (1 minute)
**Risk:** None

**Implementation:**
```javascript
main_window.on('closed', () => {
  stop_file_watcher();  // Add this line
  main_window = null;
});
```

### Option 2: Check Window Before Send in Watcher
**Pros:**
- Defensive programming

**Cons:**
- Doesn't fix memory leak
- Watcher still fires events unnecessarily
- Incomplete solution

**Effort:** Small (5 minutes)
**Risk:** Medium (doesn't solve root cause)

## Recommended Action

**Implement Option 1** - Add `stop_file_watcher()` to the window `closed` event handler.

## Technical Details

**Affected Components:**
- `src/main.js` - Window lifecycle

**Memory Impact:**
- Each orphaned watcher: ~100KB + event handlers
- In multi-window app: could leak watchers for every closed window

**Files to Modify:**
- `/Users/randallnoval/Code/markpane/src/main.js` (line 643)

## Acceptance Criteria

- [x] `stop_file_watcher()` called in `main_window.on('closed')` handler
- [ ] Test: Open file, close window, verify watcher stops
- [ ] Test: Open file, close window, open new window, verify no orphaned watchers
- [ ] Memory profiling shows no watcher leaks

## Work Log

*Findings recorded from performance-oracle agent review on 2025-02-15*

## Resources

- Agent Review: performance-oracle (ac08921)
- Related: `src/main.js:78-92` (stop_file_watcher implementation)
