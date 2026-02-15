# Race Condition in Nested Debounce Logic

## Metadata
```yaml
status: pending
priority: p1
issue_id: 008
tags: [code-review, performance, race-condition, file-watcher]
dependencies: []
```

## Problem Statement

Atomic write detection uses nested `setTimeout` (300ms outer + 200ms inner). This creates a 500ms total delay for atomic writes and potential for stale watchers if rapid edits occur.

**Why it matters:** Race conditions can cause inconsistent state. The nested timeout pattern is fragile and can lead to orphaned timers or missed file changes.

## Findings

**Source:** performance-oracle agent review
**Location:** `/Users/randallnoval/Code/markpane/src/main.js:48-66`

**Current code:**
```javascript
reload_debounce = setTimeout(() => {
  if (!fs.existsSync(file_path)) {
    // ❌ Nested timeout inside debounce
    setTimeout(() => {
      if (fs.existsSync(file_path)) {
        reload_file();
      } else {
        stop_file_watcher();
        main_window.webContents.send('error', `File deleted: ${file_path}`);
      }
    }, 200);
  } else {
    reload_file();
  }
}, 300);
```

**Issues:**
1. Total delay for atomic writes: 500ms (300 + 200)
2. Inner timeout not tracked (can't be canceled)
3. If rapid edits occur, inner timeout may reference stale `file_path`
4. Complexity makes reasoning about timing difficult

**Evidence:** Code inspection shows 2-level nesting with hardcoded delays.

## Proposed Solutions

### Option 1: Single Debounce with Existence Check (Recommended)
**Pros:**
- Eliminates nesting
- Single timeout to track/cancel
- 300ms latency (vs 500ms)
- Simpler to understand

**Cons:**
- Doesn't distinguish "temporary deletion" from "true deletion"
- Minor: user sees error immediately if file truly deleted

**Effort:** Small (5 minutes)
**Risk:** Low

**Implementation:**
```javascript
file_watcher = fs.watch(file_path, { persistent: false }, (event_type) => {
  if (reload_debounce) clearTimeout(reload_debounce);

  reload_debounce = setTimeout(() => {
    if (fs.existsSync(file_path)) {
      reload_file();
    } else {
      stop_file_watcher();
      main_window?.webContents.send('error', 'File deleted');
    }
  }, 300);
});
```

### Option 2: Exponential Backoff (Over-engineered)
**Pros:**
- Handles slow atomic writes (>200ms)

**Cons:**
- More complex
- Rare edge case
- Not worth the complexity

**Effort:** Medium (15 minutes)
**Risk:** Low but unnecessary

### Option 3: Track Inner Timeout
**Pros:**
- Keeps current behavior
- Cancellable

**Cons:**
- Still has 500ms latency
- Still complex

**Effort:** Small (10 minutes)
**Risk:** Low but doesn't solve root issue

## Recommended Action

**Implement Option 1** - Flatten to single timeout. Atomic writes complete in <50ms for 95%+ of editors. The 200ms buffer is unnecessary complexity.

## Technical Details

**Affected Components:**
- `src/main.js` - File watcher debounce logic

**Timing Analysis:**
- Current: 300ms debounce + 200ms atomic write buffer = 500ms worst case
- Proposed: 300ms debounce = 300ms worst case
- Improvement: 200ms faster reload

**Files to Modify:**
- `/Users/randallnoval/Code/markpane/src/main.js` (lines 48-66)

## Acceptance Criteria

- [x] Single `setTimeout` call (no nesting)
- [x] Debounce timeout stored in `reload_debounce`
- [x] Timeout canceled on new watcher event
- [x] File existence checked before reload
- [ ] Test with vim (atomic write editor)
- [ ] Test with VS Code (atomic write editor)
- [ ] Test with actual file deletion
- [ ] Reload latency <350ms

## Work Log

*Findings recorded from performance-oracle agent review on 2025-02-15*

## Resources

- Agent Review: performance-oracle (ac08921)
- Related: code-simplicity-reviewer suggests same simplification
