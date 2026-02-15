# Feature Comparison: markpane vs Peekdown

This table compares markpane against Peekdown based on verified implementation details. For markpane, features are split between the **main Electron app** and the **Quick Look extension** where they differ.

> **Note**: markpane's Quick Look extension has syntax highlighting, linkify, typographer, and frontmatter parsing features that the main Electron app currently lacks.

## Rendering Features

| Feature | markpane (Main App) | markpane (Quick Look) | Peekdown | Notes |
|---------|---------------------|----------------------|----------|-------|
| **GitHub-Flavored Markdown** | ✅ Partial | ✅ Partial | ✅ Full | markpane missing task lists, strikethrough |
| Tables | ✅ | ✅ | ✅ | All support GFM tables |
| Fenced code blocks | ✅ | ✅ | ✅ | |
| Syntax highlighting | ❌ | ✅ (highlight.js) | ✅ | Main app shows plain text code blocks |
| Task lists | ❌ | ❌ | ✅ | Neither markpane version renders checkboxes |
| Strikethrough | ❌ | ❌ | ✅ | |
| Autolinks | ❌ | ✅ | ✅ | Main app requires explicit markdown links |
| Typographer | ❌ | ✅ | ✅ | Smart quotes/dashes/ellipses |
| Mermaid diagrams | ✅ | ❌ | ✅ | Main app only |
| Math rendering | ❌ | ❌ | ✅ (KaTeX) | |
| Frontmatter | ❌ | ✅ (hidden) | ✅ (hidden) | Main app renders frontmatter as text |

## App Features

| Feature | markpane | Peekdown | Notes |
|---------|----------|----------|-------|
| **File watching** | ❌ | ✅ | Peekdown auto-reloads on file change |
| **Drag & drop** | ❌ | ✅ | markpane requires CLI argument |
| **Always on top** | ❌ | ✅ | |
| **Multi-window** | ❌ | ✅ | markpane single instance only |
| **Find in page** | ❌ | ✅ | |
| **Table of contents** | ❌ | ✅ | Peekdown shows heading outline |
| **Recent files** | ❌ | ✅ | |
| **Window state** | ❌ | ✅ | Peekdown remembers position/size |

## Export & Clipboard

| Feature | markpane | Peekdown | Notes |
|---------|----------|----------|-------|
| **PDF export** | ✅ | ✅ | Both via print dialog |
| **HTML export** | ❌ | ✅ | |
| **Copy code blocks** | Manual select | ✅ One-click | Peekdown adds copy buttons |

## Customization

| Feature | markpane | Peekdown | Notes |
|---------|----------|----------|-------|
| **Dark/light theme** | ✅ Auto | ✅ Auto + manual | markpane follows system only |
| **Custom fonts** | ❌ | ✅ | |
| **Keyboard shortcuts** | ❌ | ✅ | Peekdown has configurable shortcuts |

## Platform & Distribution

| Feature | markpane | Peekdown | Notes |
|---------|----------|----------|-------|
| **Architecture** | Electron (Chromium) | Native (WebKit) | Peekdown smaller, lower memory |
| **macOS Quick Look** | ✅ | ✅ | Both provide QL extensions |
| **Platform support** | macOS only | macOS only | |
| **Installation** | Manual download | Mac App Store + download | |
| **Pricing** | Free | $4.99 (App Store) / Free (direct) | |
| **License** | MIT (open source) | Proprietary | |

## Summary

**markpane strengths:**
- Mermaid diagram support
- Open source
- Free
- Quick Look has more features than main app

**Peekdown strengths:**
- Full GFM support (task lists, strikethrough)
- File watching and auto-reload
- Richer app features (multi-window, TOC, find, recent files)
- Math rendering (KaTeX)
- HTML export
- Native app (smaller, more efficient)

**markpane's internal gap:**
The Quick Look extension already has syntax highlighting, linkify, typographer, and frontmatter parsing. Bringing these to the main app would close several feature gaps without new dependencies.
