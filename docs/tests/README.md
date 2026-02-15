# Peekdown Test Files

Comprehensive test suite for all Peekdown features across 8 roadmap sessions.

## Test Files

### `comprehensive.md`
Quick validation of all 8 sessions in one file. Use this for:
- Smoke testing after builds
- Quick feature verification
- Regression testing

**Coverage:**
- Session 1: Syntax highlighting (6 languages)
- Session 2: Task lists, GFM, typographer
- Session 3-6: Pin, window state, AI files, drag-and-drop (manual tests)
- Session 7: Search & TOC
- Session 8: Copy affordances

### `syntax-highlighting.md`
In-depth syntax highlighting edge cases for Session 1:
- 10+ programming languages (JS, Python, SQL, Bash, CSS, JSON, TypeScript, Ruby, Go, Rust, YAML)
- Edge cases: empty blocks, special chars, Unicode, long lines, nested structures
- Syntax errors (should still highlight)
- Large blocks (50+ lines)

### `gfm-features.md`
GitHub Flavored Markdown edge cases for Session 2:
- Task lists: nested (3 levels), with formatting, mixed with regular lists
- Strikethrough: nested, multiple on same line, edge cases
- Linkify: URLs in text, with paths/query params, special chars
- Typographer: smart quotes, em-dash, ellipsis, combined features
- Tables: aligned columns, formatting, links, long content, special chars

### `copy-features.md`
Copy affordance edge cases for Session 8:
- Copy buttons on 10+ code block variations
- Mermaid diagrams (should NOT have copy buttons)
- Context menu on selectable text (Copy / Copy as HTML)
- Edge cases: empty blocks, special chars, theme switching
- Performance testing with many blocks

### `search-toc.md`
Search and TOC edge cases for Session 7:
- Search: "searchterm" appears 8+ times, case sensitivity, special chars, code blocks
- Navigation: Cmd+G forward, Cmd+Shift+G backward
- TOC: headings H1-H5, duplicate names, long headings, special chars
- Scroll spy: multiple sections with spacer content
- Edge cases: no matches, single match, many matches

## Testing Workflow

### Quick Test (5 min)
```bash
yarn start -- docs/tests/comprehensive.md
```
Verify all 8 sessions work.

### Full Test (20 min)
Test each feature file individually:
```bash
yarn start -- docs/tests/syntax-highlighting.md
yarn start -- docs/tests/gfm-features.md
yarn start -- docs/tests/copy-features.md
yarn start -- docs/tests/search-toc.md
```

### UAT (Production Build)
```bash
yarn build:mac
open macos/Peekdown.app
```
Drag test files onto the app icon or open from within the app.

## Manual Tests

These features require manual interaction:

**Session 3 (Pin):**
- Press `Cmd+Shift+P` to toggle always-on-top
- Verify icon changes in titlebar

**Session 4 (Window State):**
- Resize window
- Quit app (`Cmd+Q`)
- Relaunch and verify size/position restored

**Session 5 (AI Files):**
- Open `CLAUDE.md` to see AI badge
- Modify file externally
- Verify auto-reload triggers

**Session 6 (Drag-and-Drop):**
- Drag another `.md` file onto window
- Verify app loads it and updates titlebar

## Edge Cases Covered

- **Empty content:** Empty code blocks, whitespace-only blocks
- **Special characters:** HTML entities, Unicode, emojis in code
- **Long content:** 50+ line code blocks, very long single lines
- **Nested structures:** 3+ level lists, deeply nested JSON
- **Duplicates:** Duplicate headings, multiple consecutive code blocks
- **Boundaries:** First/last sections, wrapping in search navigation
- **Performance:** Many code blocks (10+), high search match counts

## Expected Behavior

### All Features Should:
- Work in both light and dark themes
- Handle edge cases gracefully (no errors, no crashes)
- Provide visual feedback (copy buttons, search highlighting, TOC active state)
- Be keyboard accessible (shortcuts work, focus visible)

### Known Limitations:
- Task list checkboxes are disabled (read-only)
- Mermaid diagrams do not have copy buttons (by design)
- Quick Look extensions require code signing to work on macOS
