---
title: feat: Add syntax highlighting and Quick Look parity to main app
type: feat
date: 2026-02-14
---

# Add Syntax Highlighting and Quick Look Parity to Main App

Bring Phase 1 features from Quick Look extension to main Electron app: syntax highlighting, linkify, typographer, and frontmatter parsing.

## Problem

The Quick Look extension has features the main app lacks:
- Syntax highlighting in code blocks (using highlight.js)
- Linkify (converts bare URLs to clickable links)
- Typographer (smart quotes, dashes, ellipses)
- Frontmatter parsing (hides YAML/TOML frontmatter)

This creates inconsistent behavior where Quick Look previews are richer than the main app.

## Acceptance Criteria

### Syntax Highlighting
- [x] Add highlight.js as dependency via `yarn add highlight.js`
- [x] Enhance fence renderer to detect language from info string
- [x] Apply `language-{lang}` and `hljs` classes to code blocks
- [x] Call `hljs.highlightElement()` after markdown rendering
- [x] Load GitHub-style CSS themes (light/dark) that match Quick Look
- [x] Theme-aware highlighting (light theme for light mode, dark for dark mode)
- [x] Unlabeled code blocks render as plain text (no auto-detection)

### Linkify & Typographer
- [x] Enable `linkify: true` in markdown-it config
- [x] Enable `typographer: true` in markdown-it config
- [x] Verify DOMPurify sanitizes linkified URLs (markdown-it runs first, then DOMPurify)

### Frontmatter Parsing
- [x] Parse YAML/TOML frontmatter before markdown rendering (only at document start)
- [x] Strip frontmatter from markdown body
- [x] Render frontmatter in styled `<section class="frontmatter">` (copy CSS from Quick Look)
- [x] Malformed frontmatter renders as-is

### Theme Switching
- [x] Highlight.js respects theme changes without re-initialization
- [x] Use CSS media queries for `prefers-color-scheme: dark`
- [x] Mermaid diagrams continue to work with existing theme logic

## Context

**Reference Implementation**: `/Users/randallnoval/Code/markpane/macos/MarkPaneQLExt/PreviewViewController.swift:149-260`

**Current State**:
- Main app: `src/renderer.js:1-2` has `markdown-it({ html: true })` only
- Quick Look: `PreviewViewController.swift:151-152` has `linkify: true, typographer: true`

**Dependencies**:
- Already have: markdown-it@14.1.0, mermaid@10.9.0, dompurify@3.0.0
- Need to add: `highlight.js` package (includes library + GitHub theme CSS)

**Dependency Strategy**:
- Install highlight.js via npm for easier updates
- Use highlight.js's built-in GitHub theme (matches Quick Look aesthetic)
- Copy frontmatter CSS from Quick Look to `assets/app.css`

**Security**: Ensure markdown-it processes content (including linkify) BEFORE DOMPurify sanitization to prevent XSS.

**Files to Modify**:
- `package.json` - add highlight.js dependency
- `src/index.html` - load highlight.js library and GitHub theme CSS
- `src/renderer.js` - markdown-it config, fence renderer, frontmatter parsing, highlight.js integration
- `assets/app.css` - add frontmatter section styles (copy from Quick Look)

## MVP

### src/renderer.js (updated markdown-it config)

```javascript
const md = window.markdownit({
  html: true,
  linkify: true,
  typographer: true
});

// Store original fence renderer
const default_fence = md.renderer.rules.fence.bind(md.renderer.rules);

md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const info = (token.info || '').trim();
  const lang = info.split(/\s+/)[0];

  // Mermaid blocks
  if (lang === 'mermaid') {
    return `<div class="mermaid">${md.utils.escapeHtml(token.content)}</div>`;
  }

  // Code blocks with language
  if (lang) {
    token.attrJoin('class', `language-${lang}`);
    token.attrJoin('class', 'hljs');
  }

  return default_fence(tokens, idx, options, env, self);
};
```

### src/renderer.js (frontmatter parsing)

```javascript
function split_frontmatter(content) {
  if (!content.startsWith('---')) {
    return { frontmatter: null, body: content };
  }

  const lines = content.split('\n');
  const end_index = lines.slice(1).findIndex(line => line.trim() === '---');

  if (end_index === -1) {
    return { frontmatter: null, body: content };
  }

  const frontmatter = lines.slice(1, end_index + 1).join('\n');
  const body = lines.slice(end_index + 2).join('\n');

  return { frontmatter, body };
}
```

### src/index.html (load highlight.js)

```html
<link rel="stylesheet" href="../node_modules/highlight.js/styles/github.css" media="(prefers-color-scheme: light)">
<link rel="stylesheet" href="../node_modules/highlight.js/styles/github-dark.css" media="(prefers-color-scheme: dark)">
<script src="../node_modules/highlight.js/lib/highlight.js"></script>
```

### src/renderer.js (highlight after render)

```javascript
// After DOMPurify sanitization
document.querySelectorAll('pre code.hljs').forEach((block) => {
  window.hljs.highlightElement(block);
});
```

## References

- Quick Look implementation: `/Users/randallnoval/Code/markpane/macos/MarkPaneQLExt/PreviewViewController.swift:149-260`
- Main app renderer: `/Users/randallnoval/Code/markpane/src/renderer.js:1-14`
- Roadmap: `/Users/randallnoval/Code/markpane/docs/ROADMAP.md` (Phase 1)
- markdown-it docs: https://github.com/markdown-it/markdown-it
- highlight.js docs: https://highlightjs.org/
