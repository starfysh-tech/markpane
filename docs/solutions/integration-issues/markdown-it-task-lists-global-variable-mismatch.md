---
title: "markdown-it-task-lists Plugin Capitalization Bug"
category: integration-issues
module: markdown-rendering
tags: [electron, markdown-it, plugin, javascript, case-sensitivity]
symptom: "Task list checkboxes render but bracket syntax [ ] [x] remains visible"
root_cause: "Plugin global variable name mismatch - markdownitTaskLists vs markdownItTaskLists"
severity: medium
date: 2026-02-14
---

# markdown-it-task-lists Plugin Capitalization Bug

## Problem

After installing and loading the `markdown-it-task-lists` plugin, task lists rendered with BOTH checkboxes AND the original bracket text `[ ]` and `[x]`, instead of clean checkboxes.

**Expected behavior:**
```markdown
- [ ] Unchecked task  →  ☐ Unchecked task
- [x] Checked task    →  ☑ Checked task
```

**Actual behavior:**
```markdown
- [ ] Unchecked task  →  ☐ [ ] Unchecked task
- [x] Checked task    →  ☑ [x] Checked task
```

## Symptom

- Task list checkboxes appeared correctly (disabled, proper checked state)
- Original bracket syntax `[ ]` and `[x]` remained in rendered text
- Plugin appeared to load (no console errors)
- Strikethrough (other Phase 2 feature) worked correctly

## Investigation Steps

1. **Verified plugin file exists:** `node_modules/markdown-it-task-lists/dist/markdown-it-task-lists.min.js` ✓
2. **Added console logging** to check plugin loading condition
3. **Checked browser console** - plugin detection failing silently
4. **Inspected minified plugin source** to find actual global export name
5. **Discovered mismatch:** Plugin exports as `markdownitTaskLists` (lowercase 'it')
6. **Code referenced:** `markdownItTaskLists` (capital 'I')

## Root Cause

The plugin exports itself to the global scope as `window.markdownitTaskLists` (camelCase with lowercase 'it'), but the code referenced `window.markdownItTaskLists` (capital 'I' in 'It').

**Evidence from plugin source:**
```javascript
// From node_modules/markdown-it-task-lists/dist/markdown-it-task-lists.min.js
e.markdownitTaskLists=n()  // lowercase 'it'
```

**Broken code:**
```javascript
// src/renderer.js
if (window.markdownItTaskLists) {  // capital 'I' - doesn't exist
  md.use(window.markdownItTaskLists, { enabled: false });
}
```

**Why it failed silently:**
- JavaScript condition evaluates `undefined` as falsy
- Plugin never registered with markdown-it
- No error thrown (valid code, just wrong variable name)
- Task list syntax passes through unprocessed

## Solution

**File:** `src/renderer.js`

**Change:** Single character fix

```diff
// Add task lists plugin (read-only checkboxes)
- if (window.markdownItTaskLists) {
+ if (window.markdownitTaskLists) {
-   md.use(window.markdownItTaskLists, { enabled: false });
+   md.use(window.markdownitTaskLists, { enabled: false });
  } else {
    console.warn('Task lists plugin not loaded');
  }
```

**Verification:**
```markdown
- [ ] Unchecked task  →  ☐ Unchecked task
- [x] Checked task    →  ☑ Checked task
- [X] Uppercase X     →  ☑ Uppercase X
```

Bracket syntax removed, checkboxes render cleanly.

## Prevention

**When adding UMD plugins loaded via `<script>` tags:**

1. Open browser DevTools console after loading
2. Check global exists: `window.pluginName`
3. If undefined, inspect minified source for actual export name
4. Update code to match exact capitalization

**Common gotcha:** Package name `markdown-it-foo` may export as `markdownitFoo` (hyphens removed, not PascalCase).

See CLAUDE.md for UMD plugin loading guidance.

## Related Issues

- highlight.js loading (commit `6efac68`) - Similar UMD global naming challenges
- Pattern: Electron renderer + UMD bundles require verifying global names
- Documentation: See CLAUDE.md "Plugin Loading Gotchas"

## Quick Reference

**If you see task lists rendering with brackets:**
1. Check `window.markdownitTaskLists` exists in browser console
2. Verify capitalization in `src/renderer.js` matches plugin export
3. Look for plugin loading in Network tab (should be 200 OK)
4. Check console for "Task lists plugin not loaded" warning
