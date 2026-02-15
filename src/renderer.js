// Render guard to prevent concurrent renders
let render_active = false;
let render_pending = null;

// Initialize markdown-it with custom fence renderer
const md = window.markdownit({
  html: true,
  linkify: true,
  typographer: true
});

// Add task lists plugin (read-only checkboxes)
if (window.markdownitTaskLists) {
  md.use(window.markdownitTaskLists, { enabled: false });
} else {
  console.warn('Task lists plugin not loaded');
}

// Enable strikethrough support
md.enable('strikethrough');

// Store default fence renderer
const default_fence = md.renderer.rules.fence.bind(md.renderer.rules);

// Custom fence: handle mermaid and syntax highlighting
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const info = (token.info || '').trim();
  const lang = info.split(/\s+/)[0];

  // Mermaid blocks
  if (lang === 'mermaid') {
    return `<div class="mermaid">${md.utils.escapeHtml(token.content)}</div>`;
  }

  // Code blocks with language - add classes for highlight.js
  if (lang) {
    token.attrJoin('class', `language-${lang}`);
    token.attrJoin('class', 'hljs');
  }

  return default_fence(tokens, idx, options, env, self);
};

// Theme detection
function get_prefers_dark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply_theme() {
  const prefers_dark = get_prefers_dark();
  document.body.classList.toggle('theme-dark', prefers_dark);
  document.body.classList.toggle('theme-light', !prefers_dark);
  return prefers_dark;
}

// Initialize mermaid
function init_mermaid(prefers_dark) {
  mermaid.initialize({
    startOnLoad: false,
    theme: prefers_dark ? 'dark' : 'neutral',
    securityLevel: 'strict',
    flowchart: {
      defaultRenderer: 'elk',
      htmlLabels: true,
      nodeSpacing: 50,
      rankSpacing: 50,
      padding: 15
    },
    elk: {
      mergeEdges: false,
      nodePlacementStrategy: 'SIMPLE'
    }
  });
}

// Convert <br/> tags to markdown string format for proper height calculation
// Mermaid has known bugs with foreignObject height when using <br/> tags
function convert_br_to_markdown_strings(content) {
  // Match node labels containing <br/> tags: identifier[label with <br/>text]
  // Convert to markdown string syntax: identifier["`label with \ntext`"]
  return content.replace(
    /\[([^\]]*<br\s*\/?>.*?)\]/gi,
    (match, label) => {
      const converted = label.replace(/<br\s*\/?>/gi, '\n');
      return '["`' + converted + '`"]';
    }
  );
}

// Render mermaid diagrams with error handling
async function render_mermaid() {
  const mermaid_elements = document.querySelectorAll('.mermaid');

  for (const element of mermaid_elements) {
    const raw_content = element.textContent;
    const content = convert_br_to_markdown_strings(raw_content);
    element.setAttribute('data-original', raw_content);

    try {
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      const { svg } = await mermaid.render(id, content);
      element.innerHTML = svg;
    } catch (err) {
      element.innerHTML = `<div class="mermaid-error">Diagram error: ${err.message}</div>`;
    }
  }
}

// Re-render mermaid on theme change
async function rerender_mermaid_with_theme() {
  const prefers_dark = get_prefers_dark();
  init_mermaid(prefers_dark);

  const mermaid_elements = document.querySelectorAll('.mermaid');
  for (const element of mermaid_elements) {
    const original = element.getAttribute('data-original');
    if (original) {
      element.textContent = original;
    }
  }

  await render_mermaid();
}

// Parse frontmatter from markdown content
function split_frontmatter(content) {
  if (!content.startsWith('---')) {
    return { frontmatter: null, body: content };
  }

  const lines = content.split('\n');
  const end_index = lines.slice(1).findIndex(line => line.trim() === '---');

  if (end_index === -1) {
    return { frontmatter: null, body: content };
  }

  const frontmatter = lines.slice(1, end_index + 1).join('\n');
  const body = lines.slice(end_index + 2).join('\n');

  return { frontmatter, body };
}

// Render markdown content
async function render_content(content) {
  // If a render is already in progress, queue this one
  if (render_active) {
    render_pending = content;
    return;
  }

  render_active = true;

  try {
    const content_element = document.getElementById('content');

    // Split frontmatter from body
    const { frontmatter, body } = split_frontmatter(content);

    // Render frontmatter section if present
    let frontmatter_html = '';
    if (frontmatter) {
      const escaped_frontmatter = frontmatter
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      frontmatter_html = `
        <section class="frontmatter">
          <div class="frontmatter-title">Frontmatter</div>
          <pre>---
${escaped_frontmatter}
---</pre>
        </section>
      `;
    }

    // Parse markdown body
    const html = md.render(body);

    // Sanitize with DOMPurify
    const clean_html = DOMPurify.sanitize(frontmatter_html + html, {
      ADD_TAGS: ['div', 'section', 'pre', 'input'],
      ADD_ATTR: ['class', 'data-original', 'type', 'disabled', 'checked']
    });

    // Inject to DOM
    content_element.innerHTML = clean_html;

    // Post-sanitization: ensure only checkbox inputs remain
    const inputs = content_element.querySelectorAll('input');
    inputs.forEach(input => {
      if (input.type !== 'checkbox') input.remove();
      if (!input.hasAttribute('disabled')) input.setAttribute('disabled', 'disabled');
    });

    // Apply syntax highlighting to code blocks
    if (window.hljs) {
      const code_blocks = content_element.querySelectorAll('pre code.hljs');
      code_blocks.forEach((block) => {
        window.hljs.highlightElement(block);
      });
    }

    // Render mermaid diagrams
    await render_mermaid();
  } finally {
    render_active = false;

    // If a render was queued while we were processing, handle it now
    if (render_pending !== null) {
      const pending = render_pending;
      render_pending = null;
      await render_content(pending);
    }
  }
}

// Show error message
function show_error(message) {
  const content_element = document.getElementById('content');
  content_element.innerHTML = `<div class="error-message">${DOMPurify.sanitize(message)}</div>`;
}

// Drag-and-drop file opening
function setup_drag_drop() {
  let drag_counter = 0;
  const overlay = document.getElementById('drop-overlay');

  document.body.addEventListener('dragenter', (e) => {
    e.preventDefault();
    drag_counter++;
    overlay.classList.add('visible');
  });

  document.body.addEventListener('dragleave', (e) => {
    e.preventDefault();
    drag_counter--;
    if (drag_counter === 0) {
      overlay.classList.remove('visible');
    }
  });

  document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    drag_counter = 0;
    overlay.classList.remove('visible');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      // Electron extension: file.path
      if (file.path) {
        window.electronAPI.openFile(file.path);
      }
    }
  });
}

// Initialize
function init() {
  let is_pdf_mode = false;

  // Apply theme (light for PDF, system preference for UI)
  function setup_theme(force_light = false) {
    const prefers_dark = force_light ? false : get_prefers_dark();
    document.body.classList.toggle('theme-dark', prefers_dark);
    document.body.classList.toggle('theme-light', !prefers_dark);
    init_mermaid(prefers_dark);
    return prefers_dark;
  }

  // Initial theme setup
  setup_theme();

  // Listen for theme changes (only in UI mode)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    if (is_pdf_mode) return;
    setup_theme();
    await rerender_mermaid_with_theme();
  });

  // Receive file content from main process
  window.electronAPI.onFileContent(async (content, filename, pdf_mode) => {
    is_pdf_mode = pdf_mode;

    // Force light theme for PDF export
    if (is_pdf_mode) {
      setup_theme(true);
    }

    if (filename) {
      document.getElementById('filename').textContent = filename;
    }
    await render_content(content);
  });

  // Auto-reload on file change
  window.electronAPI.onFileChanged(async (content, filename) => {
    if (is_pdf_mode) return;

    // Save scroll position as ratio
    const content_element = document.getElementById('content');
    const scroll_ratio = content_element.scrollHeight > 0
      ? content_element.scrollTop / content_element.scrollHeight
      : 0;

    // Update filename if provided
    if (filename) {
      document.getElementById('filename').textContent = filename;
    }

    // Re-render content
    await render_content(content);

    // Restore scroll position
    const new_scroll_top = scroll_ratio * content_element.scrollHeight;
    content_element.scrollTop = new_scroll_top;
  });

  // Receive errors from main process
  window.electronAPI.onError((message) => {
    show_error(message);
  });

  // Always-on-top indicator
  window.electronAPI.onAlwaysOnTopChanged((is_pinned) => {
    const indicator = document.getElementById('pin-indicator');
    indicator.classList.toggle('visible', is_pinned);
  });

  // Setup drag-and-drop
  setup_drag_drop();
}

init();
