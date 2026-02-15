# Unbounded Scroll Position Calculation (Divide by Zero)

## Metadata
```yaml
status: pending
priority: p2
issue_id: 011
tags: [code-review, performance, bug, scroll-position]
dependencies: []
```

## Problem Statement

Scroll position calculation divides by `scrollHeight` without checking if it's zero. If content is still rendering, `scrollHeight` can be 0, causing `NaN` scroll position.

**Why it matters:** NaN propagates through calculations and causes scroll position to be lost during reload. While it accidentally works (NaN * height = 0), it's fragile and relies on undefined behavior.

## Findings

**Source:** performance-oracle agent review
**Location:** `/Users/randallnoval/Code/markpane/src/renderer.js:307-320`

**Current code:**
```javascript
// Save scroll position as ratio
const content_element = document.getElementById('content');
const scroll_ratio = content_element.scrollTop / content_element.scrollHeight;

// ... re-render ...

// Restore scroll position
const new_scroll_top = scroll_ratio * content_element.scrollHeight;
content_element.scrollTop = new_scroll_top;
```

**Issue:**
- If `scrollHeight === 0` → `scroll_ratio = NaN`
- Then `new_scroll_top = NaN * scrollHeight = NaN`
- Setting `scrollTop = NaN` converts to 0 (accidental correctness)

**Evidence:** Code inspection shows no bounds check.

## Proposed Solutions

### Option 1: Add Bounds Check (Recommended)
**Pros:**
- Explicit, correct handling
- No reliance on NaN coercion
- Self-documenting

**Cons:**
- None

**Effort:** Tiny (2 minutes)
**Risk:** None

**Implementation:**
```javascript
// Save scroll position as ratio
const content_element = document.getElementById('content');
const scroll_ratio = content_element.scrollHeight > 0
  ? content_element.scrollTop / content_element.scrollHeight
  : 0;

// ... re-render ...

// Restore scroll position
const new_scroll_top = scroll_ratio * content_element.scrollHeight;
content_element.scrollTop = new_scroll_top;
```

### Option 2: Guard Both Sides
**Pros:**
- Extra defensive

**Cons:**
- Redundant if ratio is already bounded

**Effort:** Tiny (3 minutes)
**Risk:** None

**Implementation:**
```javascript
const scroll_ratio = content_element.scrollHeight > 0
  ? content_element.scrollTop / content_element.scrollHeight
  : 0;

// Restore
if (content_element.scrollHeight > 0) {
  content_element.scrollTop = scroll_ratio * content_element.scrollHeight;
}
```

## Recommended Action

**Implement Option 1** - Simple bounds check prevents divide-by-zero.

## Technical Details

**Affected Components:**
- `src/renderer.js` - File change handler

**Edge Cases:**
- Empty file (scrollHeight = 0)
- Content still rendering (scrollHeight = 0)
- Very small files (scrollHeight < scrollTop - shouldn't happen)

**Files to Modify:**
- `/Users/randallnoval/Code/markpane/src/renderer.js` (line 308)

## Acceptance Criteria

- [x] Bounds check added: `scrollHeight > 0`
- [ ] Test: reload empty file, verify no NaN
- [ ] Test: reload during render, verify scroll preserved
- [ ] Test: reload normal file, verify scroll preserved

## Work Log

*Findings recorded from performance-oracle and architecture-strategist agent reviews on 2025-02-15*

## Resources

- Agent Review: performance-oracle (ac08921)
- Agent Review: architecture-strategist (a098d8f)
