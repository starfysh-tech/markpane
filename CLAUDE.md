# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
yarn install                        # Install dependencies
yarn start -- ./f.md                # View file
yarn start -- ./f.md --pdf out.pdf  # Export to PDF
yarn build:quicklook                # Build Quick Look helper + extension
yarn build:mac                      # Package for macOS
```

## Quick Look Signing

Quick Look extensions are ignored by macOS unless the host app and extension are signed with a valid Developer ID Application certificate. Ad-hoc signatures will fall back to the built-in plain text preview.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Electron                      │
├──────────────────┬──────────────────────────────┤
│   Main Process   │      Renderer Process        │
│   src/main.js    │      src/renderer.js         │
│                  │                              │
│  - File I/O      │  - markdown-it parsing       │
│  - Window mgmt   │  - mermaid rendering         │
│  - CLI args      │  - DOM injection             │
│  - IPC send      │  - Theme detection           │
└────────┬─────────┴──────────────┬───────────────┘
         │    src/preload.js      │
         └────── contextBridge ───┘
```

**Key Files:**
- `src/main.js` - Electron main process, CLI args, window management
- `src/preload.js` - IPC bridge via contextBridge (exposes `window.electronAPI`)
- `src/renderer.js` - Markdown parsing, mermaid rendering, theme handling
- `assets/app.css` - Theme variables, layout, titlebar styling

## Code Conventions

**Naming:**
- Functions/variables: `snake_case` (e.g., `render_content`, `file_path`)
- CSS classes: `kebab-case` (e.g., `titlebar-spacer`, `markdown-body`)
- IPC channels: `kebab-case` (e.g., `file-content`, `error`)

**CSS Theme Variables:**
- All colors use CSS variables defined in `:root` and `.theme-dark`
- Variable naming: `--category-property` (e.g., `--bg-color`, `--text-secondary`)

## Patterns

**Adding IPC channels:**
1. Define channel in `main.js`: `webContents.send('channel-name', data)`
2. Expose in `preload.js`: `ipcRenderer.on('channel-name', callback)`
3. Consume in `renderer.js`: `window.electronAPI.onChannelName(callback)`

**Adding mermaid error handling:**
- Wrap mermaid.render() in try/catch
- On error, replace element content with styled `.mermaid-error` div

**Theme-aware rendering:**
- Check `window.matchMedia('(prefers-color-scheme: dark)').matches`
- Re-render mermaid on theme change (original content stored in `data-original` attribute)

## Security Requirements

- `contextIsolation: true` / `nodeIntegration: false` - Never change these
- All HTML output must be sanitized with DOMPurify before DOM injection
- Mermaid `securityLevel: 'strict'` - No click handlers in diagrams
- Never expose Node APIs to renderer directly

## Anti-patterns

- Don't inject unsanitized HTML into the DOM - always use DOMPurify
- Don't enable nodeIntegration in window config
- Don't bypass preload.js for IPC communication
- Don't hardcode colors - use CSS variables for theme support
