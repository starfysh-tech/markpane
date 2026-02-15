# markpane Development Roadmap

This roadmap outlines planned enhancements to markpane, organized into phases based on implementation effort and dependency relationships.

## Phase 1: Internal Parity

**Goal**: Bring main app features up to par with the Quick Look extension.

These features already exist in the Quick Look Swift code (`quicklook-helper/`). The main app just needs equivalent JavaScript implementations using the same libraries and markdown-it configuration.

- [ ] **Syntax highlighting** — Already bundled (highlight.js) for Quick Look; add to main app renderer
- [ ] **Linkify** — Convert bare URLs to clickable links (markdown-it built-in option)
- [ ] **Typographer** — Smart quotes, dashes, ellipses (markdown-it built-in option)
- [ ] **Frontmatter parsing** — Hide YAML/TOML frontmatter instead of rendering as text

**Why first**: Low effort (mostly configuration changes), eliminates internal feature inconsistency, improves user experience without new dependencies.

---

## Phase 2: GFM Parity

**Goal**: Support the full GitHub-Flavored Markdown spec.

Basic markdown features users expect from any GitHub-flavored renderer.

- [ ] **Task lists** — Render `- [ ]` and `- [x]` as checkboxes (markdown-it-task-lists plugin)
- [ ] **Strikethrough** — Support `~~text~~` syntax (markdown-it config or plugin)

**Why second**: Common GFM features, minimal dependencies, expected by users familiar with GitHub markdown.

---

## Phase 3: File Interaction

**Goal**: Improve core file viewer UX.

- [ ] **Auto-reload on file change** — Watch file and refresh content (fs.watch or chokidar)
- [ ] **Drag-and-drop file opening** — Accept file drops in window
- [ ] **Always-on-top / pin window** — Keep window above others (Electron BrowserWindow option)

**Why third**: High-value UX improvements for daily use. Auto-reload is the most requested feature. Drag-and-drop removes CLI friction.

---

## Phase 4: Navigation & Search

**Goal**: Power-user features for working with long documents.

- [ ] **Find in page** (Cmd+F) — Standard browser find dialog
- [ ] **Table of contents** — Collapsible heading outline in sidebar
- [ ] **Keyboard shortcuts** — Navigate headings, scroll, toggle features

**Why fourth**: Useful but not critical. Requires UI changes (TOC sidebar) and keyboard event handling. Benefits users working with large markdown files.

---

## Phase 5: Session & Multi-Window

**Goal**: Stateful app behavior and advanced window management.

- [ ] **Window position/size persistence** — Remember window geometry across sessions
- [ ] **Recent files list** — Quick access to previously opened files
- [ ] **Multiple window support** — Open multiple markdown files simultaneously

**Why last**: Most complex. Requires state management, menu integration, and multi-instance coordination. Nice-to-have features that don't affect core rendering quality.

---

## Distribution & Platform

Independent of feature phases:

- [ ] **Homebrew formula** — Easier installation via `brew install markpane`
- [ ] **Windows/Linux support** — Electron app works cross-platform; Quick Look is macOS-only

---

## Not Planned

Features deliberately excluded to maintain focus:

- **Math rendering (KaTeX/MathJax)** — Niche use case, large dependency
- **HTML export** — PDF export via print covers most needs
- **Custom themes/fonts** — System theme auto-detection is sufficient
- **Native app rewrite** — Electron provides cross-platform benefits

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for how to help implement these features.
