---
title: "highlight.js ES module compatibility in Electron renderer context"
date: 2026-02-14
category: integration-issues
tags: [highlight.js, electron, browser-compatibility, cdn, es-modules]
component: renderer-process
severity: medium
status: resolved
---

# highlight.js npm Package Incompatibility in Electron Renderer

## Symptom

- **Error**: "Uncaught ReferenceError: require is not defined" when using highlight.js from node_modules
- **Behavior**: Code blocks lacked syntax highlighting in Electron renderer
- **Failed attempts**:
  - `lib/highlight.js` path doesn't exist in npm package
  - `lib/index.js` is CommonJS, requires `require()`
  - ES module import from `es/index.js` still internally uses CommonJS

## Root Cause

highlight.js npm package ships with:
- **CommonJS builds** (`lib/`) - require Node.js `require()` function
- **ES module builds** (`es/`) - but these still import CommonJS internals

Electron renderer context with `nodeIntegration: false`:
- No access to `require()` or Node.js APIs
- Can only execute browser-compatible JavaScript
- Cannot use npm packages designed for Node.js/bundlers

**Without a bundler** (webpack/vite), npm packages don't work directly in browser contexts. CDN builds are pre-bundled for browsers.

## Solution

**Step 1: Add CDN script to index.html**

Replace any existing highlight.js imports with CDN links:

```html
<!-- In <head> section -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css" media="(prefers-color-scheme: light)">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css" media="(prefers-color-scheme: dark)">

<!-- Before closing </body> tag -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
```

**Step 2: Update Content Security Policy**

Modify CSP meta tag to allow CDN resources:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://cdnjs.cloudflare.com;
  style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;
">
```

**Step 3: Initialize in renderer.js**

After DOM content loads:

```javascript
// Apply syntax highlighting to code blocks
if (window.hljs) {
  const code_blocks = content_element.querySelectorAll('pre code.hljs');
  code_blocks.forEach((block) => {
    window.hljs.highlightElement(block);
  });
}
```

**Step 4: Verify**

- Open DevTools Console (View → Toggle Developer Tools)
- Check for `hljs` object: `console.log(window.hljs)`
- Verify code blocks have `hljs` class and color styling
- No "require is not defined" errors

## Code Examples

**Complete index.html structure:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;">
  <title>MarkPane</title>

  <!-- highlight.js theme (light/dark) -->
  <link rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css"
        media="(prefers-color-scheme: light)">
  <link rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css"
        media="(prefers-color-scheme: dark)">

  <link rel="stylesheet" href="assets/app.css">
</head>
<body>
  <div id="content"></div>

  <!-- Load highlight.js before renderer -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
  <script type="module" src="renderer.js"></script>
</body>
</html>
```

**renderer.js initialization:**

```javascript
// After markdown rendering and DOMPurify sanitization
function render_content(content) {
  // ... markdown rendering code ...

  // Apply syntax highlighting
  if (window.hljs) {
    const code_blocks = content_element.querySelectorAll('pre code.hljs');
    code_blocks.forEach((block) => {
      window.hljs.highlightElement(block);
    });
  }

  // ... rest of rendering ...
}
```

**Evidence of success:**
- DevTools Console shows no module errors
- Code blocks render with syntax colors matching GitHub theme
- Theme switches between light/dark correctly with system preference

## Prevention

### Identifying Browser-Compatible Packages

**Check package.json before installing:**
- Look for `"browser"` field - indicates browser-compatible entry point
- Check for `"unpkg"` or `"jsdelivr"` fields - CDN-ready builds
- Review `"exports"` field for `"browser"` or `"default"` conditions
- Examine `"type": "module"` vs CommonJS (no type field)

**Inspect dist/ directory structure:**
```bash
# After yarn add, check what's actually built
ls node_modules/highlight.js/
# Look for: /es/, /lib/, browser.js, index.js patterns
```

**Test import compatibility:**
- npm packages in Electron renderer without bundler need browser builds
- CommonJS (`require()`) won't work in `<script type="module">`
- ES modules from npm may have Node.js-specific imports (`fs`, `path`)

### Module System Decision Tree

```
Browser code in Electron (no bundler)?
├─ Need npm features (tree-shaking, imports)?
│  └─ Use CDN with ES module build (esm.sh, jsdelivr, unpkg)
├─ Simple library, performance critical?
│  └─ Use CDN with minified browser build
└─ Complex bundling needs?
   └─ Add webpack/vite (outside current scope)
```

## Best Practices

### When to Use CDN vs npm in Electron

**Use CDN when:**
- Renderer process needs library but main/preload don't
- Package has official browser builds (highlight.js, mermaid, etc.)
- No bundler configured (current MarkPane setup)
- Library updates independently of app releases
- Reducing bundle size for distribution

**Use npm when:**
- Shared code between main/renderer/preload
- Node.js-specific libraries (main process only)
- Need exact version lock (CDN downtime risk)
- Offline-first requirement
- Using bundler (webpack/vite) in renderer

### Checking if npm Package is Browser-Ready

**Quick validation steps:**
1. Read package.json `"browser"` field - if present, likely browser-ready
2. Check for UMD/browser builds in package root or `/dist`
3. Search README for "CDN", "browser", "unpkg" keywords
4. Test in browser console:
   ```javascript
   // Open DevTools in Electron app
   import('https://esm.sh/package-name').then(console.log)
   ```

**Red flag inspection:**
```json
// node_modules/package/package.json
{
  "main": "lib/index.js",        // ⚠️ Often Node.js CommonJS
  "type": "commonjs",            // ⚠️ Not ES module
  "browser": undefined           // ⚠️ No browser build
}
```

### CSP Configuration for External Resources

**MarkPane CSP configuration:**
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' https://cdnjs.cloudflare.com;
               style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;">
```

**Best practices:**
- Whitelist specific CDN domains (cdnjs, jsdelivr, unpkg, esm.sh)
- Avoid `'unsafe-eval'` - blocks arbitrary code execution
- Keep `'unsafe-inline'` minimal (needed for mermaid inline scripts)
- Use Subresource Integrity (SRI) hashes for CDN scripts when possible:
  ```html
  <script src="https://cdn.jsdelivr.net/..."
          integrity="sha384-..."
          crossorigin="anonymous"></script>
  ```

### Offline Considerations with CDN Dependencies

**Risks:**
- App fails to render without internet
- CDN downtime breaks features
- Version changes break compatibility

**Mitigation strategies:**

1. **Hybrid approach (recommended for MarkPane):**
   ```javascript
   // Try CDN first, fall back to vendored copy
   const script = document.createElement('script');
   script.src = 'https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/es/index.min.js';
   script.onerror = () => {
     const fallback = document.createElement('script');
     fallback.src = './vendor/highlight.js';
     document.head.appendChild(fallback);
   };
   ```

2. **Local vendoring:**
   - Download CDN file to `assets/vendor/`
   - Update build script to copy to `dist/`
   - Change `<script src>` to local path

3. **Cache-first service worker:**
   - Cache CDN resources on first load
   - Serve from cache offline
   - Update cache on app launch when online

## Testing

### Verifying Syntax Highlighting Works

**Visual checks:**
```markdown
<!-- Test file: test-highlighting.md -->
# Syntax Test

```javascript
const test = 'highlighted';
console.log(test);
```

```python
def test():
    return "highlighted"
```

```bash
echo "highlighted"
```
```

Open in MarkPane - code blocks should have:
- Color syntax highlighting
- Proper language detection
- Consistent font (monospace)

**Browser console verification:**
```javascript
// Open DevTools (Cmd+Option+I)
// Check for errors on page load
console.log(window.hljs);  // Should show highlight.js object

// Manual test
const code = document.querySelector('pre code');
hljs.highlightElement(code);  // Should apply highlighting
```

**Theme switching test:**
1. Open markdown with code blocks
2. Toggle system dark/light mode (System Settings > Appearance)
3. Verify highlighting colors adapt to theme
4. Check console for re-initialization errors

## Red Flags

### Warning Signs of Browser Incompatibility

**Package.json indicators:**
```json
{
  "main": "lib/index.js",           // ⚠️ CommonJS entry (Node.js)
  "type": "commonjs",               // ⚠️ Not ES module
  "browser": null,                  // ⚠️ No browser build
  "exports": {
    ".": {
      "node": "./lib/index.js"      // ⚠️ Only Node.js export
    }
  }
}
```

**Documentation red flags:**
- Installation guide only shows `npm install` + `import` (assumes bundler)
- "Requires webpack/rollup/vite" in README
- Examples use `require()` without browser alternative
- No CDN usage examples
- Dependencies include Node.js core modules (`fs`, `path`, `crypto`)

**Runtime errors:**
```javascript
// Console errors indicating incompatibility:
Uncaught SyntaxError: Cannot use import statement outside a module
Uncaught ReferenceError: require is not defined
Uncaught ReferenceError: exports is not defined
Uncaught TypeError: Failed to resolve module specifier
```

**File structure warnings:**
```
node_modules/package/
├── lib/           ⚠️ Usually CommonJS source
├── src/           ⚠️ Unbundled source (needs build)
├── dist/          ✓ Might have browser builds
│   ├── index.js   ⚠️ Check if ES module or UMD
│   └── browser.js ✓ Explicit browser build
└── package.json
```

**Testing checklist before committing:**
- [ ] Run app with DevTools open - check console for errors
- [ ] Test feature (syntax highlighting) visually works
- [ ] Verify CSP allows CDN domain (no blocked resource errors)
- [ ] Toggle dark/light theme - no breaking errors
- [ ] Check network tab - CDN resource loads successfully (200 status)
- [ ] Test offline behavior (disconnect network) - decide if graceful degradation needed

## Related Issues

- **Recent highlight.js integration fixes** (commits 6efac68, 5dffed8, a1a1e75)
  - Problem: npm package paths (`../node_modules/highlight.js/lib/index.js`) failed in Electron renderer
  - Root cause: Electron's renderer process can't resolve Node.js module paths without bundler
  - Solution progression: Tried `lib/index.js` → ES module import → CDN build
  - Final fix: Switched to CDN (cdnjs.cloudflare.com) with CSP policy allowing external scripts

- **Feature gap between Quick Look and main app** (/Users/randallnoval/Code/markpane/docs/FEATURES.md)
  - Quick Look extension has syntax highlighting (highlight.js bundled)
  - Main app initially lacked this, causing inconsistent rendering
  - Plan document tracked implementation of parity features

## See Also

### Electron Security & CSP
- **Content Security Policy** enforced in `/Users/randallnoval/Code/markpane/src/index.html`
  - `script-src 'self' https://cdnjs.cloudflare.com` - allows CDN scripts
  - `style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com` - allows CDN styles + inline
- **contextBridge pattern** documented in `/Users/randallnoval/Code/markpane/CLAUDE.md:69-74`
  - `contextIsolation: true` / `nodeIntegration: false` required
  - Preload script exposes limited API via `window.electronAPI`
  - Prevents direct Node.js API access from renderer

### Browser Compatibility
- **highlight.js CDN builds** - pre-bundled for browser use
  - URL: `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js`
  - No module resolution needed
  - Works in renderer without webpack/vite
- **npm vs CDN decision** documented in git history (commits b1de26a → 6efac68)
  - npm install kept for version tracking in package.json
  - CDN used for actual script loading
  - Avoids bundler requirement for simple Electron app

## Cross-References

- **Phase 1 plan**: `/Users/randallnoval/Code/markpane/docs/plans/2026-02-14-feat-add-syntax-highlighting-and-quick-look-parity-to-main-app-plan.md`
  - Tracks syntax highlighting implementation (now complete)
  - Documents dependency strategy and security considerations
  - References highlight.js integration at lines 24-31

- **Roadmap Phase 1**: `/Users/randallnoval/Code/markpane/docs/ROADMAP.md:6-17`
  - Syntax highlighting listed as first priority
  - Part of "Internal Parity" goal (Quick Look → main app)

- **Architecture docs**: `/Users/randallnoval/Code/markpane/CLAUDE.md:19-41`
  - Electron process model (main/renderer/preload)
  - Security requirements section (lines 69-74)
  - Anti-patterns to avoid (lines 76-81)
