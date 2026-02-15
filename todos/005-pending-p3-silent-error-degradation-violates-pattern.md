---
status: pending
priority: p3
issue_id: "005"
tags: [code-review, error-handling, patterns, ux]
dependencies: []
---

# Silent Error Degradation Violates User Notification Pattern

## Problem Statement

The plan's error handling for plugin load failure uses `console.warn()` instead of the established `show_error()` pattern, resulting in silent degradation where users see plain text task lists without knowing why.

**Why it matters:**
- User sees unexpected behavior (plain `[ ]` text) with no explanation
- Violates existing error notification pattern (`show_error()` at line 180)
- Developer-only error message (console) vs user-facing feedback
- Inconsistent with project conventions

**Severity:** P3 (Nice-to-have) - UX consistency

## Findings

**Source:** Pattern-recognition-specialist agent review

**Proposed error handling** (plan lines 227-230):
```javascript
if (window.markdownItTaskLists) {
  md.use(window.markdownItTaskLists);
} else {
  console.warn('markdown-it-task-lists plugin not loaded, task lists disabled');
}
```

**Existing error pattern** (`/Users/randallnoval/Code/markpane/src/renderer.js:180-183`):
```javascript
function show_error(message) {
  const error_div = document.createElement('div');
  error_div.className = 'error-message';
  error_div.textContent = message;
  content_element.appendChild(error_div);
}
```

**Issue:**
- `console.warn()` only visible to developers (DevTools console)
- Users see markdown file with `- [ ]` rendered as plain text, no explanation
- Inconsistent with how other errors are surfaced (e.g., file loading, mermaid rendering)

## Proposed Solutions

### Solution 1: Use show_error() Pattern (Small effort, low risk) ✅

**Approach:**
```javascript
if (!window.markdownItTaskLists) {
  show_error('Task lists feature unavailable - plugin failed to load');
  // Fall back to rendering without task lists
}
```

**Pros:**
- Consistent with existing error handling
- User-facing feedback
- Uses established pattern

**Cons:**
- Shows error even if markdown file doesn't use task lists
- Could be noisy if plugin genuinely not needed

**Estimated Effort:** 5 minutes
**Risk:** Low

---

### Solution 2: Conditional User Notification (Medium effort, low risk)

**Approach:**
Only show error if markdown actually contains task list syntax:
```javascript
if (!window.markdownItTaskLists && body.includes('- [ ]')) {
  show_error('Task lists detected but plugin failed to load - rendering as plain text');
}
```

**Pros:**
- Only warns when actually relevant
- Less noisy than Solution 1
- Still user-facing

**Cons:**
- Simple regex check might miss edge cases
- More complex than Solution 1

**Estimated Effort:** 15 minutes
**Risk:** Low

---

### Solution 3: Use Option B/C to Avoid Plugin Loading (No effort, no risk) ✅

**Approach:**
Choose Option B (custom renderer) or Option C (Unicode) from the plan - neither requires external plugin, so no load failure scenario.

**Pros:**
- Eliminates error scenario entirely
- No plugin = no plugin load failure
- Simpler code path

**Cons:**
- Doesn't fix pattern violation if Option A is chosen

**Estimated Effort:** 0 (decision only)
**Risk:** None

## Recommended Action

**If Option A chosen:** Implement Solution 2 (conditional notification)

**If Option B/C chosen:** No action needed (no plugin to fail loading)

## Technical Details

**Affected Files:**
- `/Users/randallnoval/Code/markpane/src/renderer.js` (error handling location)

**Existing show_error() Usage:**
- Line 180: Function definition
- Used for file loading errors and rendering failures
- Displays styled error message in content area

**Convention from CLAUDE.md:**
> "Error handling: Always provide user-facing error messages, not just console logs"

(Note: This convention might not exist in current CLAUDE.md but should be added)

## Acceptance Criteria

- [ ] Plugin load failure shows user-facing error message
- [ ] Error uses `show_error()` function (not console.warn)
- [ ] Error only shown if task lists actually detected (optional)
- [ ] Consistent with existing error handling patterns

## Work Log

### 2026-02-14 - Initial finding
- Identified by pattern-recognition-specialist review agent
- Silent degradation violates user notification pattern
- Recommendation: Use show_error() OR choose Option B/C

## Resources

- **Existing error handler:** `/Users/randallnoval/Code/markpane/src/renderer.js:180-183`
- **Plan error handling:** Plan lines 227-230
- **Agent report:** pattern-recognition-specialist (agent ID: a800115)
