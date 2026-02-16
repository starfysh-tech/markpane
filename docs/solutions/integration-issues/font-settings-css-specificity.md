---
title: Font Settings CSS Specificity and Custom Dropdown Improvements
slug: font-settings-css-specificity-dropdown-improvements
date: 2026-02-15
problem_type: ui_bug
component: Settings Panel (Font Customization)
tags: [css, specificity, font-settings, tooltips, keyboard-navigation, inline-styles, dropdown-ui]
severity: medium
status: resolved
reporter: Randall
solver: Claude Code
related_issues: []
---

## Problem

Font selection dropdown saved body font preference to session settings but changes didn't apply to rendered markdown content. Code font selection worked correctly, but body font had no visible effect.

## Investigation

**Initial debugging steps:**

1. Verified font preference saved correctly to session settings
2. Confirmed `apply_settings_to_window()` called `apply_font_to_window()`
3. Checked that `apply_font_to_window()` set `document.body.style.fontFamily`
4. Inspected computed styles in DevTools - found body font wasn't being applied

**Key discovery:**

Code font worked because it used CSS variables:
```css
:root {
  --code-font: 'Menlo', 'Monaco', monospace;
}

pre, code {
  font-family: var(--code-font) !important;
}
```

Body font failed because it relied on inline styles:
```javascript
document.body.style.fontFamily = font;
```

## Root Cause

**CSS Specificity Conflict:**

`github-markdown.css` line 8 declares:
```css
.markdown-body {
  font-family: -apple-system, BlinkMacSystemFont, ...;
}
```

This class selector (specificity `0,1,0`) overrides the inherited value from `document.body.style.fontFamily`. Even though inline styles normally win, inheritance doesn't create an inline style on `.markdown-body` - the element's own stylesheet rule takes precedence.

Code font worked because:
- Used CSS variables with `!important`
- Applied directly to `pre, code` elements
- `!important` flag overrode all other declarations

## Solution

**Apply the same CSS variable pattern to body font:**

### 1. Add CSS Variable Declaration

In `assets/app.css`:
```css
:root {
  --custom-body-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  --custom-body-font-size: 16px;
  --custom-code-font: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  --custom-code-font-size: 14px;
}

#content.markdown-body {
  font-family: var(--custom-body-font) !important;
  font-size: var(--custom-body-font-size) !important;
}
```

### 2. Update JavaScript to Set CSS Variable

In `src/renderer.js`, modify `apply_settings()`:
```javascript
function apply_settings(settings) {
  current_settings = settings;
  const content_el = document.getElementById('content');

  // Apply fonts via CSS custom properties
  if (content_el) {
    // Body font
    const body_font = settings.bodyFont === 'San Francisco'
      ? '-apple-system, BlinkMacSystemFont'
      : `"${settings.bodyFont}"`;
    const body_fallback = ', "Segoe UI", Helvetica, Arial, sans-serif';

    content_el.style.setProperty('--custom-body-font', body_font + body_fallback);
    content_el.style.setProperty('--custom-body-font-size', (settings.bodyFontSize || '16') + 'px');

    // Code font
    const code_font = settings.codeFont === 'SF Mono'
      ? 'ui-monospace, SFMono-Regular, "SF Mono"'
      : `"${settings.codeFont}"`;
    const code_fallback = ', Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

    content_el.style.setProperty('--custom-code-font', code_font + code_fallback);
    content_el.style.setProperty('--custom-code-font-size', (settings.codeFontSize || '14') + 'px');
  }
}
```

**Why this works:**
- CSS variables on `:root` (document element) have highest scope
- `!important` flag ensures variable value overrides github-markdown.css
- Setting via `setProperty()` updates live stylesheet, no DOM re-render needed
- Consistent pattern with existing code font implementation

**Additional improvements implemented:**

- Type-ahead navigation: Press letter key in font dropdown to jump to matching font
- Tooltips: Titlebar buttons show name + keyboard shortcut (e.g., "Toggle TOC (⌘⇧O)")

## Related Documentation

### Integration Issues
- **[highlightjs-npm-electron-incompatibility.md](highlightjs-npm-electron-incompatibility.md)**
  - CDN stylesheet loading patterns and CSP configuration
  - External resource integration with `<link>` tags
  - Theme-aware stylesheet loading via `media` attribute

- **[markdown-it-task-lists-global-variable-mismatch.md](markdown-it-task-lists-global-variable-mismatch.md)**
  - UMD plugin loading verification patterns
  - Global variable naming debugging techniques

### Security Issues
- **[../security-issues/phase4-security-audit-report.md](../security-issues/phase4-security-audit-report.md)**
  - CSP configuration for external resources
  - DOMPurify ALLOWED_ATTR configuration
  - ARIA attributes for accessibility

### Performance Issues
- **[../performance-issues/scroll-handler-performance-optimization.md](../performance-issues/scroll-handler-performance-optimization.md)**
  - CSS variable optimization patterns
  - ARIA attributes and keyboard navigation
  - DOMPurify configuration cleanup

## Cross-References

### CSS Specificity Patterns in Codebase
- **`assets/app.css` (lines 62-82)**: Uses `!important` declarations to override github-markdown.css font styles
  - Code fonts: `font-family: var(--custom-code-font) !important;`
  - Body fonts: `font-family: var(--custom-body-font) !important;`
  - Pattern: Custom font system relies on `!important` to override external stylesheet

### External Stylesheet Integration
- **highlight.js CDN themes** (documented in highlightjs-npm-electron-incompatibility.md):
  - Uses theme-aware loading: `media="(prefers-color-scheme: dark)"`
  - CSP whitelist: `style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com`
  - Pattern: External stylesheets loaded via CDN with CSP restrictions

### UI/UX Enhancement Patterns
- **ROADMAP.md**: Keyboard shortcuts listed as Phase 4 feature
- **FEATURES.md**: Keyboard shortcuts comparison with Peekdown
- **Accessibility considerations**: ARIA attributes documented in security audits
  - `aria-level`, `tabindex`, `role` attributes used for TOC navigation
  - Keyboard focus management patterns established

## Prevention

### CSS Specificity Management
- **Use `!important` selectively** for theme-agnostic overrides that must supersede external stylesheets (e.g., GitHub Markdown CSS)
- Apply `!important` only on CSS custom properties set dynamically via JavaScript, not on static theme values
- Define CSS variables at `:root` level for global defaults, then override via inline styles on specific elements

### External Stylesheet Integration
- **Anticipate specificity conflicts** when integrating third-party CSS (GitHub Markdown, syntax highlighters)
- Apply custom properties to the most specific selector necessary (e.g., `#content.markdown-body` instead of `body`)
- Use inline `element.style.setProperty()` for runtime-configured values to guarantee highest specificity

### Accessibility First
- **Always provide keyboard equivalents** for mouse interactions (click, hover, drag)
- Implement ARIA roles (`role="option"`, `aria-expanded`) for custom UI components
- Use semantic HTML where possible before reaching for `role` attributes
- Add tooltips with keyboard shortcuts using `data-tooltip-shortcut` for discoverability

### Settings Persistence
- **Validate saved settings on load** - ensure fonts exist in system before applying
- Handle missing fonts gracefully (e.g., show "(not installed)" suffix)
- Apply settings atomically - update both UI controls and rendered content in same transaction

## Best Practices

### CSS Variable Pattern
```css
/* Define defaults at :root */
:root {
  --custom-code-font: system-ui;
  --custom-code-font-size: 14px;
}

/* Apply with !important where external CSS may conflict */
#content code {
  font-family: var(--custom-code-font) !important;
  font-size: var(--custom-code-font-size) !important;
}
```

```javascript
// Override at runtime via inline styles
element.style.setProperty('--custom-code-font', user_font);
```

**Why**: Inline styles beat all external stylesheets. Custom properties allow centralized updates without redefining selectors.

### Type-Ahead Navigation
```javascript
// In keydown handler for dropdown
if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
  const letter = e.key.toLowerCase();
  const idx = options.findIndex(opt =>
    opt.getAttribute('data-value').toLowerCase().startsWith(letter)
  );
  if (idx >= 0) {
    focused_index = idx;
    options[focused_index].scrollIntoView({ block: 'nearest' });
  }
}
```

**Why**: Improves accessibility for long lists. Users can jump to fonts starting with a letter instead of arrowing through 50+ items.

### Tooltip Pattern with Shortcuts
```css
[data-tooltip][data-tooltip-shortcut]:not([data-tooltip-shortcut=""])::after {
  content: attr(data-tooltip) "\A" attr(data-tooltip-shortcut);
  white-space: pre;
  line-height: 1.6;
}
```

```html
<button data-tooltip="Toggle Outline" data-tooltip-shortcut="⌘⇧O"></button>
```

**Why**: Single source of truth for shortcuts. Shows keyboard equivalents on hover without duplicating text in HTML.

### Settings Synchronization
```javascript
// Centralized apply_settings function
function apply_settings(settings) {
  // 1. Update internal state
  current_settings = settings;

  // 2. Apply to DOM via CSS variables
  element.style.setProperty('--custom-body-font', font_stack);

  // 3. Update UI controls
  set_custom_select_value(body_font_select, settings.bodyFont);

  // 4. Trigger re-render if needed
  await rerender_mermaid_with_theme();
}

// Called from multiple sources
window.electronAPI.onSettings(apply_settings);
window.electronAPI.onSettingsChanged(apply_settings);
```

**Why**: Single code path for applying settings prevents UI/state drift. Works for initial load, user changes, and cross-window sync.

## Testing Checklist

### Font Selection
- [ ] Body font selection applies to all markdown content (paragraphs, headings, lists)
- [ ] Code font selection applies to inline code, code blocks, and frontmatter
- [ ] Font changes are visible immediately without page reload
- [ ] Previously selected fonts persist after restarting the app
- [ ] Uninstalled fonts show "(not installed)" label but don't break the UI

### Type-Ahead Navigation
- [ ] Opening dropdown and typing "H" jumps to first font starting with H
- [ ] Subsequent key presses jump to next matching font
- [ ] Works for both body and code font dropdowns
- [ ] Arrow keys still navigate normally after type-ahead
- [ ] Enter/Space selects the focused font

### Tooltips
- [ ] Tooltips show on hover after 500ms delay
- [ ] "Table of Contents" tooltip shows `⌘⇧O` shortcut
- [ ] "Settings" tooltip shows `⌘,` shortcut
- [ ] Tooltips position correctly below titlebar buttons
- [ ] Tooltips are readable in both light and dark themes
- [ ] Tooltips disappear when mouse leaves button

### Keyboard Shortcuts
- [ ] `Cmd+Shift+O` toggles TOC sidebar
- [ ] `Cmd+,` toggles settings panel
- [ ] `Cmd+F` opens find bar
- [ ] `Escape` closes settings panel when open
- [ ] `Escape` closes find bar when open
- [ ] `Escape` quits app when no panels are open

### Settings Persistence
- [ ] Font selections persist across app restarts
- [ ] Font size selections persist across app restarts
- [ ] Theme selection (system/light/dark) persists
- [ ] Settings apply correctly when opening multiple windows
- [ ] Changing settings in one window updates all open windows

### CSS Specificity
- [ ] Custom fonts override GitHub Markdown CSS
- [ ] Code font applies to syntax-highlighted blocks
- [ ] Mermaid error blocks use monospace code font
- [ ] TOC and settings panel respect theme colors
- [ ] Print preview shows correct fonts (no runtime CSS)
