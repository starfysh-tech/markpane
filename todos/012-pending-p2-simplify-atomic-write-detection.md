# Atomic Write Detection Over-Engineered

## Metadata
```yaml
status: pending
priority: p2
issue_id: 012
tags: [code-review, simplicity, yagni, file-watcher]
dependencies: [008]
```

## Problem Statement

Atomic write handling uses nested setTimeout with 200ms + 300ms delays to detect "temporary deletion" vs "true deletion". Most editors complete atomic writes in <50ms, making the 200ms buffer unnecessary complexity.

**Why it matters:** YAGNI violation. The complexity adds no value for 95%+ of use cases. Simpler code is easier to maintain and reason about.

## Findings

**Source:** code-simplicity-reviewer agent review
**Location:** `/Users/randallnoval/Code/markpane/src/main.js:48-66`

**Current approach:**
```javascript
reload_debounce = setTimeout(() => {
  if (!fs.existsSync(file_path)) {
    // Complex nested timeout for atomic write detection
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
1. 200ms is arbitrary guesswork
2. Nesting makes timing hard to reason about
3. Total 500ms delay for atomic writes
4. Rare edge case (user deleting file while viewing) doesn't justify complexity

**Evidence from simplicity review:** "Most editors complete atomic writes in <50ms. The 200ms delay is arbitrary guesswork. Simpler: just reload when file exists again, no deletion detection needed."

## Proposed Solutions

### Option 1: Single Debounce (Recommended)
**Pros:**
- Eliminates nesting (~15 lines removed)
- 300ms latency vs 500ms
- Handles 99% of cases correctly
- Much simpler to understand

**Cons:**
- Shows error immediately if file truly deleted (acceptable UX)

**Effort:** Small (5 minutes)
**Risk:** Low

**Implementation:**
```javascript
file_watcher = fs.watch(file_path, { persistent: false }, (event_type) => {
  if (reload_debounce) clearTimeout(reload_debounce);

  reload_debounce = setTimeout(() => {
    if (fs.existsSync(file_path)) {
      reload_file();
    }
  }, 300);
});
```

**Note:** File deletion case can be handled by watcher error event instead of checking in timeout.

### Option 2: Keep Current (Not Recommended)
**Pros:**
- Handles slow editors (>200ms atomic writes)

**Cons:**
- Adds complexity for rare edge case
- No evidence this is needed

**Effort:** None
**Risk:** Technical debt accumulates

## Recommended Action

**Implement Option 1** - Remove atomic write detection complexity. Trust the 300ms debounce.

## Technical Details

**LOC Reduction:** ~15 lines (nested timeout logic)

**Complexity Reduction:**
- Before: 2-level nested timeouts
- After: Single timeout

**Files to Modify:**
- `/Users/randallnoval/Code/markpane/src/main.js` (lines 48-66)

## Acceptance Criteria

- [ ] Single `setTimeout` (no nesting)
- [ ] File existence checked before reload
- [ ] Test with vim (atomic write)
- [ ] Test with VS Code (atomic write)
- [ ] Test with Emacs (atomic write)
- [ ] Latency <350ms

## Work Log

*Findings recorded from code-simplicity-reviewer agent review on 2025-02-15*

*Note: This is the same code flagged in issue #008 (nested debounce race condition). Fixing #008 will also resolve this YAGNI violation.*

## Resources

- Agent Review: code-simplicity-reviewer (a6b7fc6)
- Related Issue: #008 (nested debounce race condition)
