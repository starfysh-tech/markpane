# MarkPane Support

## Getting Started

MarkPane is a simple, lightweight markdown viewer for macOS that supports mermaid diagrams and syntax highlighting.

### Opening Files

**Method 1: Drag & Drop**
- Drag a `.md` file onto the MarkPane app icon

**Method 2: Command Line**
```bash
/Applications/MarkPane.app/Contents/MacOS/MarkPane yourfile.md
```

**Method 3: Quick Look**
- Select a `.md` file in Finder
- Press Space to preview

### Supported Features

- ✅ GitHub Flavored Markdown
- ✅ Mermaid diagrams (flowcharts, sequence diagrams, etc.)
- ✅ Syntax highlighting for code blocks
- ✅ Task lists (- [ ] checkbox syntax)
- ✅ Dark mode support
- ✅ Quick Look extension

## Frequently Asked Questions

### How do I view a markdown file?

Simply drag and drop a `.md` file onto the MarkPane app, or open it via command line.

### Does MarkPane support mermaid diagrams?

Yes! MarkPane fully supports mermaid.js syntax for:
- Flowcharts
- Sequence diagrams
- Class diagrams
- State diagrams
- And more

### Can I edit markdown in MarkPane?

No, MarkPane is a **viewer only**. Use your favorite text editor (VS Code, Sublime, etc.) to edit, and MarkPane to view.

### Does Quick Look work?

Yes! The Quick Look extension lets you preview `.md` files in Finder by selecting the file and pressing Space.

If Quick Look doesn't work:
1. Ensure MarkPane is in `/Applications`
2. Run: `qlmanage -r` in Terminal
3. Restart Finder

### Does MarkPane require an internet connection?

No, MarkPane works completely offline. Network access is only used if your markdown file references external images.

### Is my data private?

Yes. MarkPane processes everything locally on your Mac. We never collect, store, or transmit any of your files or personal information. See our [Privacy Policy](PRIVACY_POLICY.md).

## Troubleshooting

### Quick Look extension not working

```bash
# Reset Quick Look cache
qlmanage -r
qlmanage -r cache

# Verify extension is registered
pluginkit -m -p com.apple.quicklook.preview
```

### Mermaid diagrams not rendering

Ensure your mermaid syntax is valid. Common issues:
- Missing diagram type declaration
- Syntax errors in the diagram code
- Invalid node or connection syntax

Test your diagram at: https://mermaid.live

### Dark mode not working

MarkPane automatically follows your macOS system appearance. Toggle dark mode in:
**System Settings → Appearance → Dark**

## Feature Requests

Have an idea for MarkPane? We'd love to hear it!

Contact: [support email needed]

## Report a Bug

Found a bug? Please include:
- macOS version
- MarkPane version (Help → About MarkPane)
- Steps to reproduce
- Expected vs actual behavior
- Sample markdown file (if applicable)

Contact: [support email needed]

## System Requirements

- macOS 10.12 (Sierra) or later
- Apple Silicon (M1/M2/M3) or Intel processor
- 50 MB disk space

## Contact

**Starfysh, LLC**
- Support Email: [support email needed]
- Website: [website needed]

---

**Version:** 1.3.0
**Last Updated:** February 15, 2026
