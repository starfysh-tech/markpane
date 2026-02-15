# Duplicated Menu Toggle Logic

## Metadata
```yaml
status: pending
priority: p2
issue_id: 013
tags: [code-review, patterns, duplication, refactoring]
dependencies: []
```

## Problem Statement

The always-on-top toggle logic is duplicated in two places: the IPC handler and the menu click handler. Both contain identical 20-line blocks for toggling, updating menu state, and notifying renderer.

**Why it matters:** Code duplication creates maintenance burden. Changes must be made in two places, increasing risk of bugs from inconsistent updates.

## Findings

**Source:** pattern-recognition-specialist agent review
**Location:** `/Users/randallnoval/Code/markpane/src/main.js:713-735, 856-877`

**Duplicated code:**
```javascript
// IPC handler (lines 713-735)
ipcMain.on('toggle-always-on-top', () => {
  if (!main_window || main_window.isDestroyed()) return;
  const is_pinned = !main_window.isAlwaysOnTop();
  main_window.setAlwaysOnTop(is_pinned);

  const menu = Menu.getApplicationMenu();
  if (menu) {
    const pin_item = menu.getMenuItemById('pin-window');
    if (pin_item) { pin_item.checked = is_pinned; }
  }

  if (main_window && !main_window.isDestroyed()) {
    main_window.webContents.send('always-on-top-changed', is_pinned);
  }
});

// Menu click handler (lines 856-877) - EXACT SAME CODE
click: () => {
  if (!main_window || main_window.isDestroyed()) return;
  const is_pinned = !main_window.isAlwaysOnTop();
  main_window.setAlwaysOnTop(is_pinned);

  const menu = Menu.getApplicationMenu();
  if (menu) {
    const pin_item = menu.getMenuItemById('pin-window');
    if (pin_item) { pin_item.checked = is_pinned; }
  }

  if (main_window && !main_window.isDestroyed()) {
    main_window.webContents.send('always-on-top-changed', is_pinned);
  }
}
```

## Proposed Solutions

### Option 1: Extract Shared Function (Recommended)
**Pros:**
- Single source of truth
- Easier to modify/test
- Follows DRY principle

**Cons:**
- None

**Effort:** Small (10 minutes)
**Risk:** None

**Implementation:**
```javascript
function toggle_always_on_top() {
  if (!main_window || main_window.isDestroyed()) return;

  const is_pinned = !main_window.isAlwaysOnTop();
  main_window.setAlwaysOnTop(is_pinned);

  // Update menu checkmark
  const menu = Menu.getApplicationMenu();
  if (menu) {
    const pin_item = menu.getMenuItemById('pin-window');
    if (pin_item) {
      pin_item.checked = is_pinned;
    }
  }

  // Notify renderer
  if (main_window && !main_window.isDestroyed()) {
    main_window.webContents.send('always-on-top-changed', is_pinned);
  }
}

// Then use in both places:
ipcMain.on('toggle-always-on-top', toggle_always_on_top);

// In menu:
click: toggle_always_on_top
```

### Option 2: Menu Triggers IPC
**Pros:**
- One code path

**Cons:**
- Indirect (menu → IPC → main)
- Less clear

**Effort:** Small (10 minutes)
**Risk:** Low

## Recommended Action

**Implement Option 1** - Extract to shared function.

## Technical Details

**LOC Reduction:** ~20 lines

**Files to Modify:**
- `/Users/randallnoval/Code/markpane/src/main.js` (lines 713-735, 856-877)

## Acceptance Criteria

- [ ] Single `toggle_always_on_top()` function
- [ ] IPC handler calls function
- [ ] Menu click handler calls function
- [ ] Test: keyboard shortcut toggles correctly
- [ ] Test: menu item toggles correctly
- [ ] Test: both update menu checkmark
- [ ] Test: both show pin indicator

## Work Log

*Findings recorded from pattern-recognition-specialist agent review on 2025-02-15*

## Resources

- Agent Review: pattern-recognition-specialist (a4e7d62)
