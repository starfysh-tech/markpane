# Peekdown Feature Roadmap

Progress tracker for the 8-session feature implementation plan.

## Session 1: Syntax Highlighting Alignment

**Goal:** Add highlight.js to match Quick Look's 37-language support

- [x] Add `highlight.js@^11.9.0` to package.json
- [x] Copy highlight CSS files from Quick Look resources
- [x] Add highlight.js script and CSS links to index.html
- [x] Implement `highlight_code_blocks()` function in renderer.js
- [x] Update fence renderer to add language classes
- [x] Add `.theme-dark .hljs` scope overrides in app.css
- [x] Verify: syntax highlighting works in light/dark themes
- [x] Verify: mermaid blocks still render correctly
- [x] Verify: auto-detection works for unlabeled code blocks

**Gotchas discovered:**
- Dark theme CSS needed full `.theme-dark` scope prefix (Quick Look uses media queries)
- Highlight must run after DOMPurify to preserve `<span>` tags with classes
- Re-highlighting on theme change requires removing `hljs-processed` class first
- Fence renderer uses `token.attrJoin()` to add classes to code blocks

---

## Session 2: Task Lists & GFM Parity

**Goal:** Render checkboxes and strikethrough, align markdown-it config with Quick Look

- [x] Add `markdown-it-task-lists@^2.1.1` to package.json
- [x] Add task-lists plugin script tag to index.html
- [x] Update markdown-it config: `{ html: true, linkify: true, typographer: true }`
- [x] Add task-lists plugin: `md.use(window.markdownitTaskLists, { enabled: false, label: false })`
- [x] Verify DOMPurify allowlist includes input/checkbox attributes
- [x] Verify: checkboxes render and are disabled (read-only)
- [x] Verify: strikethrough works
- [x] Verify: URLs auto-link, smart quotes work

**Gotchas discovered:**
- DOMPurify requires explicit ADD_ATTR for `type`, `disabled`, `checked` attributes
- Strikethrough (`<s>` tag) also needs to be added to ADD_TAGS for sanitization

---

## Session 3: Always-on-Top Pin

**Goal:** Titlebar pin button + menu item + keyboard shortcut

- [x] Add `ipcMain` to main.js requires
- [x] Implement `toggle-pin` IPC handler in main.js
- [x] Add `Cmd+Shift+P` keyboard shortcut
- [x] Add View menu with pin checkbox item
- [x] Add pin button to titlebar in index.html
- [x] Implement `togglePin` and `onPinStateChanged` in preload.js
- [x] Add pin button click handler in renderer.js
- [x] Add pin button styling (SVG icon, rotation, theme-aware) in app.css
- [x] Skip pin button and shortcut in PDF mode
- [x] Add pin state stub to preferences
- [ ] Verify: pin toggles window always-on-top
- [ ] Verify: menu shows checkmark when active
- [ ] Verify: icon visually changes between states
- [ ] Verify: no pin UI in PDF mode

**Gotchas discovered:**

---

## Session 4: Session Memory & Window State

**Goal:** Persist window size/position, last file, preferences

- [x] Implement `load_preferences()` in main.js
- [x] Implement `save_preferences()` with debouncing (500ms)
- [x] Add window state tracking (resize/move events)
- [x] Restore window bounds in `create_window()`
- [x] Restore last file on standalone launch (no CLI arg)
- [x] Define preferences schema: `{ window: {...}, last_file, always_on_top, toc_visible, recent_files: [] }`
- [x] Skip persistence in PDF mode
- [x] Add graceful fallback for deleted last file
- [x] Verify: window size/position persists across restarts
- [x] Verify: last file reopens on launch without args
- [x] Verify: CLI arg overrides last file
- [x] Verify: graceful handling of missing last file

**Gotchas discovered:**
- Preferences must be loaded before `BrowserWindow` creation to set initial bounds
- Window state tracking requires debouncing to avoid excessive I/O
- `is_minimized()` check prevents saving incorrect bounds during minimize events
- PDF mode skips all preferences loading/saving to avoid side effects
- Removed global `pin_state` variable in favor of `preferences.always_on_top`
- Window bounds restoration happens before window creation, not after
- Last file restore only happens in `did-finish-load` when no CLI file arg provided

---

## Session 5: AI File Awareness

**Goal:** Detect AI context files, show badge, auto-reload on changes

- [x] Implement `is_ai_context_file()` detection in main.js
- [x] Add `fs.watch` with 200ms debounce for detected files
- [x] Implement `file-changed` IPC channel
- [x] Add badge element to titlebar in index.html
- [x] Implement `onFileChanged` and `onAIFileDetected` in preload.js
- [x] Add file-changed handler (re-render) in renderer.js
- [x] Add badge UI in renderer.js
- [x] Add badge styling in app.css
- [x] Clean up watcher on window close
- [x] Handle `rename` event (file deletion/move)
- [ ] Verify: badge appears for AI context files
- [ ] Verify: file auto-reloads on external edits
- [ ] Verify: no badge/watcher for regular .md files
- [ ] Verify: no double-rendering on rapid saves
- [ ] Verify: no watcher leaks after window close

**AI filename patterns:** `CLAUDE.md`, `.claude/**/*.md`, `llms.txt`, `llms-full.txt`, `.cursorrules`, `PROMPT.md`, `AGENTS.md`, `COPILOT.md`, `.github/copilot-instructions.md`, `rules.md`, `.windsurfrules`

**Gotchas discovered:**

---

## Session 6: Drag-and-Drop + Recent Files

**Goal:** Accept file drops, handle macOS open-file, maintain recent files menu

- [ ] Register `app.on('open-file')` before `app.whenReady()` in main.js
- [ ] Implement `load_file()` function in main.js
- [ ] Add recent files menu (max 10, deduplicated)
- [ ] Implement `open-file-request` IPC handler
- [ ] Add `openFile` channel in preload.js
- [ ] Add drag-over/drop event handlers in renderer.js
- [ ] Add drag-over visual feedback to index.html
- [ ] Add drag-over overlay styling in app.css
- [ ] Filter to only accept `.md` files on drop
- [ ] Rebuild app menu when recent files change
- [ ] Verify: dragging .md file renders it
- [ ] Verify: non-.md files ignored
- [ ] Verify: Recent Files menu shows last 10 files
- [ ] Verify: clicking recent file loads it
- [ ] Verify: recent files persist across restarts

**Gotchas discovered:**

---

## Session 7: Document Search + Collapsible TOC

**Goal:** Cmd+F search with navigation, collapsible left sidebar TOC with scroll spy

### Search
- [x] Register `Cmd+F`, `Cmd+G`, `Cmd+Shift+G` shortcuts in main.js
- [x] Modify Escape behavior (close search, not window) in main.js
- [x] Add search bar element to index.html
- [x] Implement TreeWalker search with `<mark>` wrapping in renderer.js
- [x] Add match counter ("3 of 12") in renderer.js
- [x] Implement next/prev navigation in renderer.js
- [x] Add search bar styling in app.css
- [x] Add `<mark>` highlight styling in app.css
- [x] Clear search state on content re-render

### TOC
- [x] Register `Cmd+Shift+T` shortcut in main.js
- [x] Add TOC sidebar element to index.html
- [x] Add TOC toggle button to titlebar
- [x] Implement TOC generation from h1-h6 in renderer.js
- [x] Implement `IntersectionObserver` scroll spy in renderer.js
- [x] Add TOC sidebar styling (~200px, transitions) in app.css
- [x] Add content margin transition when TOC opens
- [x] Persist TOC open/closed state in preferences
- [x] Regenerate TOC on content re-render

### Verification
- [ ] Verify: Cmd+F opens search, highlights matches
- [ ] Verify: Cmd+G/Cmd+Shift+G cycles matches
- [ ] Verify: Escape closes search (not window)
- [ ] Verify: Cmd+Shift+T toggles TOC
- [ ] Verify: clicking TOC item scrolls to heading
- [ ] Verify: current heading highlighted while scrolling
- [ ] Verify: both work in light/dark themes

**Gotchas discovered:**

---

## Session 8: Copy Affordances

**Goal:** Code block copy button, context menu, Edit menu

- [x] Add Edit menu (Copy, Select All) to main.js
- [x] Implement `context-menu` handler in main.js
- [x] Add IPC for copy operations in preload.js
- [x] Implement `add_copy_buttons()` after render in renderer.js
- [x] Add context menu data in renderer.js
- [x] Add copy button hover styling in app.css
- [x] Re-add copy buttons on content re-render
- [ ] Verify: copy button appears on code block hover
- [ ] Verify: click copy -> text in clipboard + "Copied!" feedback
- [ ] Verify: right-click selection -> Copy/Copy as HTML
- [ ] Verify: Cmd+C works (Edit menu)
- [ ] Verify: no copy button on mermaid diagrams
- [ ] Verify: theme-aware in light/dark

**Gotchas discovered:**

---

## Session End Protocol

For each completed session:

1. ✅ Update checkboxes in this file
2. ✅ Run verification steps
3. ✅ Update CLAUDE.md if new patterns/conventions added
4. ✅ Commit: `feat: <session description>`
5. ✅ Document gotchas in relevant section

---

## Feature Parity Status

After all 8 sessions, Peekdown vs QuickMD:

| Feature | QuickMD | Peekdown | Status |
|---------|---------|----------|--------|
| Syntax highlighting | ~10 langs | 37+ langs | ✅ Ahead |
| Task lists | Yes | Yes | ✅ Complete |
| Find + TOC | Yes | Session 7 | 🟡 Planned |
| Mermaid diagrams | No | Yes | ✅ Ahead |
| Quick Look | No | Yes | ✅ Ahead |
| Always-on-top | No | Session 3 | ✅ Unique |
| AI file awareness | No | Session 5 | ✅ Unique |
| Auto-reload | No | Session 5 | ✅ Unique |
