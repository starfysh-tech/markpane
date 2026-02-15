# Phase 2: GFM Features Test

This file tests GitHub Flavored Markdown features added in Phase 2.

## 1. Task Lists (Read-Only Checkboxes)

### Project Tasks
- [x] Implement syntax highlighting
- [x] Add linkify support
- [x] Add typographer
- [x] Support frontmatter
- [ ] Add table support
- [ ] Add emoji support
- [ ] Add footnotes

### Nested Task Lists
- [x] Phase 1 Complete
  - [x] Core features
  - [x] Mermaid diagrams
  - [x] Theme support
- [x] Phase 2 Complete
  - [x] Task lists
  - [x] Strikethrough
- [ ] Phase 3 In Progress
  - [x] Auto-reload
  - [x] Drag-and-drop
  - [x] Always-on-top
  - [ ] Testing

### Shopping List
- [ ] Eggs
- [ ] Milk
- [x] Bread
- [ ] Butter
- [x] Coffee

## 2. Strikethrough

### Basic Strikethrough
This is ~~wrong~~ correct.

### Multiple Strikethrough
~~First mistake~~ ~~Second mistake~~ Final version.

### In Lists
1. ~~Old item~~
2. Current item
3. ~~Deprecated~~ Updated item

### In Tables
| Status | Description |
|--------|-------------|
| ~~Planned~~ | Not happening |
| In Progress | Working on it |
| ~~Blocked~~ Done | Unblocked and complete |

## 3. Combined Features

### Todo with Strikethrough
- [x] ~~Use old API~~ Migrate to new API
- [x] Update documentation
- [ ] ~~Add feature X~~ Feature X cancelled
- [ ] Deploy to production

### Code with GFM
```javascript
// Task list in code (should not be interactive)
const tasks = [
  "- [ ] Task 1",
  "- [x] Task 2",
  "- [ ] Task 3"
];

// Strikethrough in string
const note = "~~This is struck through~~";
```

## Expected Results

✅ Checkboxes render correctly (read-only)
✅ Checked boxes show checkmark
✅ Unchecked boxes are empty
✅ Strikethrough text has line through it
✅ Nested task lists work
✅ All checkboxes are disabled (not clickable)
✅ Task lists in code blocks are NOT interactive
