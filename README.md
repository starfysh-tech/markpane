# MarkPane

**Hit spacebar. See rendered markdown. That's it.**

A lightweight markdown viewer for macOS that brings beautiful GitHub-style rendering to Finder's Quick Look. View markdown files with mermaid diagrams instantly—no apps to launch, no context switching.

[**🌐 Website**](https://starfysh-tech.github.io/markpane/) • [**📥 Download**](https://github.com/starfysh-tech/markpane/releases/latest)

---

## Why MarkPane?

| ❌ Without MarkPane | ✅ With MarkPane |
|---------------------|------------------|
| Finder shows markdown as ugly plain text | Spacebar = instant preview with styling |
| Open VS Code just to check a README | Your mermaid diagrams render automatically |
| Your beautiful diagrams? Invisible. | One command for PDF export |
| Export to PDF? Open an app, configure settings, pray... | Zero configuration needed |

---

## Features

### 🔍 Quick Look Integration
Spacebar in Finder. That's all. Your markdown renders instantly with zero friction.

### 📊 Mermaid Diagrams
Flowcharts, sequence diagrams, ERDs—all rendered live as crisp SVG. Adapts to your theme automatically.

### 🎨 40+ Language Syntax Highlighting
Python, JavaScript, Go, Rust, and more highlighted automatically with highlight.js.

### 🌓 Theme Aware
Follows your macOS appearance. Light mode, dark mode—diagrams adapt automatically.

### 📄 PDF Export
One command: `markpane file.md --pdf out.pdf`. Diagrams scale perfectly. Done.

### 🔐 100% Local & Private
- **No data collection** - Zero telemetry or tracking
- **Fully local** - All rendering happens on your device
- **Works offline** - No internet required
- **No AI processing** - Pure markdown rendering

---

## Installation

### For End Users

**Download the latest release:**

```bash
# Download from GitHub Releases
https://github.com/starfysh-tech/markpane/releases/latest

# Extract and drag to Applications folder
# Launch once to register Quick Look extension
```

### For Developers

```bash
git clone https://github.com/starfysh-tech/markpane.git
cd markpane
yarn install
yarn link
```

---

## Usage

### Quick Look (macOS 14+)

1. Select any `.md` file in Finder
2. Press **Spacebar**
3. See beautifully rendered markdown

### Command Line

```bash
# View markdown file
markpane ./README.md

# Export to PDF
markpane ./README.md --pdf output.pdf

# Uninstall Quick Look extension
markpane --uninstall-quicklook

# Uninstall everything
markpane --uninstall-all
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Escape` | Close window |
| `Cmd+W` | Close window |
| `Cmd+Q` | Quit app |

---

## Quick Look Technical Details

MarkPane bundles a Quick Look extension for rendering Markdown (including mermaid) in Finder previews.

**Requirements:**
- macOS 14+
- Developer ID Application signature (included in releases)

**Build from source:**

```bash
yarn build:quicklook
```

On first launch, MarkPane will prompt to move into `/Applications` or `~/Applications` and register the Quick Look extension.

**Debugging:**

```bash
# Enable telemetry
markpane --ql-debug

# Check logs
cat ~/Library/Application\ Support/MarkPane/quicklook-telemetry.json

# Enable Quick Look extension debug
defaults write com.markpane.app.quicklook-host.quicklook QLDebug -bool YES

# View extension logs
cat ~/Library/Containers/com.markpane.app.quicklook-host.quicklook/Data/Library/Caches/quicklook-extension.log
```

---

## Development

### Build Commands

```bash
yarn start -- ./file.md                    # Launch with file
yarn start -- ./file.md --pdf out.pdf      # Export to PDF
yarn build                                 # Package with electron-builder
yarn build:quicklook                       # Build Quick Look helper + extension
yarn build:mac                             # Full macOS build with notarization
```

### Tech Stack

- **Electron** - Cross-platform desktop framework
- **markdown-it** - Markdown parser
- **mermaid** - Diagram rendering (with ELK layout)
- **highlight.js** - Code syntax highlighting
- **DOMPurify** - HTML sanitization

---

## Notarization

Set these values in `.env` before running `yarn build:mac`:

```bash
NOTARY_KEY_ID=...
NOTARY_ISSUER_ID=...
NOTARY_KEY_PATH=/absolute/path/to/AuthKey_XXXX.p8
NOTARY_TEAM_ID=A3KNB5VZH2
NOTARY_APPLE_ID=...
NOTARY_APP_PASSWORD=...
```

---

## Security

- **`contextIsolation: true`** - Enabled
- **`nodeIntegration: false`** - Disabled
- **HTML sanitization** - All output sanitized with DOMPurify
- **Mermaid security** - `securityLevel: 'strict'` (no click handlers)

---

## Contributing

Issues and pull requests welcome! See [CLAUDE.md](CLAUDE.md) for development guidelines.

---

## License

MIT © Starfysh

---

## Roadmap

- [ ] Homebrew formula for easier installation
- [ ] Windows/Linux support (Electron app works, Quick Look is macOS-only)
