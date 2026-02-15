---
title: feat: Add GFM parity - task lists and strikethrough
type: feat
date: 2026-02-14
---

# Add GFM Parity - Task Lists and Strikethrough

Implement Phase 2 of the roadmap: support GitHub-Flavored Markdown task lists and strikethrough syntax.

## Problem

Main app lacks basic GFM features that users expect:
- Task lists (`- [ ]` and `- [x]`) render as plain text instead of checkboxes
- Strikethrough (`~~text~~`) doesn't render

Quick Look extension also lacks these features, so this brings both up to GFM spec.

## Acceptance Criteria

### Task Lists
- [ ] Install `markdown-it-task-lists` plugin via `yarn add markdown-it-task-lists`
- [ ] Register plugin with markdown-it in renderer.js
- [ ] Update DOMPurify to allow `<input>` tags with `type`, `disabled`, `checked` attributes
- [ ] Verify `- [ ]` renders as unchecked checkbox
- [ ] Verify `- [x]` renders as checked checkbox
- [ ] CSS already exists in `assets/github-markdown.css:135-142` (no changes needed)

### Strikethrough
- [ ] Enable built-in strikethrough via `md.enable('strikethrough')`
- [ ] Add CSS styles for `<del>` tags in `assets/github-markdown.css`
- [ ] Verify `~~text~~` renders with strikethrough styling
- [ ] Theme-aware styling (light/dark mode)

## Context

**Current State:**
- markdown-it@14.1.0 (has built-in strikethrough support)
- Phase 1 complete: syntax highlighting, linkify, typographer, frontmatter
- Task list CSS already exists: `assets/github-markdown.css:135-142`

**Implementation Pattern (from Phase 1):**
1. Add npm dependency
2. Load script in `src/index.html` from `node_modules`
3. Configure in `src/renderer.js`
4. Update security (DOMPurify allowlist)

**Security:**
- DOMPurify must allow `<input>` tags for task lists
- Task list checkboxes are `disabled` (read-only, not interactive)
- Strikethrough uses `<del>` tag (already safe)

**Files to Modify:**
- `package.json` - add markdown-it-task-lists dependency
- `src/index.html` - load task-lists plugin script
- `src/renderer.js` - register plugin, enable strikethrough, update DOMPurify
- `assets/github-markdown.css` - add strikethrough styles

## MVP

### package.json
```json
{
  "dependencies": {
    "markdown-it-task-lists": "^2.1.1"
  }
}
```

### src/index.html (load plugin)
```html
<script src="../node_modules/markdown-it-task-lists/dist/markdown-it-task-lists.min.js"></script>
```

### src/renderer.js (configure markdown-it)
```javascript
const md = window.markdownit({
  html: true,
  linkify: true,
  typographer: true
}).use(window.markdownItTaskLists)
  .enable('strikethrough');
```

### src/renderer.js (update DOMPurify)
```javascript
const sanitized_html = DOMPurify.sanitize(html, {
  ADD_TAGS: ['div', 'section', 'pre', 'input'],
  ADD_ATTR: ['class', 'data-original', 'type', 'disabled', 'checked']
});
```

### assets/github-markdown.css (strikethrough styles)
```css
.markdown-body del,
.markdown-body s {
  text-decoration: line-through;
  opacity: 0.7;
  color: var(--text-secondary);
}
```

## References

- Roadmap: `/Users/randallnoval/Code/markpane/docs/ROADMAP.md` (Phase 2)
- Current renderer: `/Users/randallnoval/Code/markpane/src/renderer.js:1-180`
- Task list CSS: `/Users/randallnoval/Code/markpane/assets/github-markdown.css:135-142`
- Plugin docs: https://github.com/revin/markdown-it-task-lists
- markdown-it strikethrough: https://github.com/markdown-it/markdown-it#syntax-extensions
