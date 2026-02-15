// GitHub-compatible slug generator for TOC IDs
class SlugGenerator {
  constructor() {
    this.occurrences = new Map();
  }

  slug(text) {
    // Normalize Unicode to NFC
    const normalized = text.normalize('NFC');

    // Generate base slug (GitHub algorithm)
    const base = normalized
      .toLowerCase()
      .replace(/<[^>]*>/g, '')      // Strip HTML tags
      .replace(/[^\w\s-]/g, '')      // Remove special chars except word, space, hyphen
      .replace(/\s+/g, '-')          // Spaces to hyphens
      .replace(/-+/g, '-')           // Collapse multiple hyphens
      .replace(/^-|-$/g, '');        // Trim edge hyphens

    // Handle empty slugs
    if (!base) {
      return `heading-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Handle duplicates
    if (!this.occurrences.has(base)) {
      this.occurrences.set(base, 0);
      return `user-content-${base}`;
    }

    const count = this.occurrences.get(base) + 1;
    this.occurrences.set(base, count);
    return `user-content-${base}-${count}`;
  }

  reset() {
    this.occurrences.clear();
  }
}

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

// Extract heading text (strips task-list checkboxes)
function extract_heading_text(heading) {
  const clone = heading.cloneNode(true);

  // Remove task-list checkboxes from heading text
  clone.querySelectorAll('input[type="checkbox"]').forEach(el => el.remove());

  return clone.textContent.trim();
}

// Extract TOC from rendered DOM
function extract_toc() {
  const content_element = document.getElementById('content');
  const headings = Array.from(content_element.querySelectorAll('h1, h2, h3, h4, h5, h6'));

  if (headings.length === 0) {
    return [];
  }

  const slugger = new SlugGenerator();
  const toc_items = headings.map(heading => {
    const text = extract_heading_text(heading);
    const id = slugger.slug(text);

    // Set ID on heading element
    heading.setAttribute('id', id);

    return {
      id,
      text,
      level: parseInt(heading.tagName[1]),
      element: heading
    };
  });

  return toc_items;
}

// Build hierarchical TOC HTML tree
function build_toc_html(items) {
  if (items.length === 0) {
    return '<div class="toc-empty">No headings found<div class="toc-empty-hint">Add headings (# Title) to enable navigation</div></div>';
  }

  let html = '';
  let stack = [];  // Track nesting levels
  let first_item = true;

  items.forEach((item, index) => {
    // Close groups for shallower levels
    while (stack.length > 0 && stack[stack.length - 1] >= item.level) {
      stack.pop();
      html += '</ul></li>';
    }

    // Open new group if deeper
    if (stack.length === 0 || stack[stack.length - 1] < item.level) {
      if (stack.length === 0) {
        html += '<ul role="group">';
      } else {
        html += '<ul role="group">';
      }
      stack.push(item.level);
    }

    const tabindex = first_item ? '0' : '-1';
    first_item = false;

    // Check if this item has children (next item is deeper)
    const has_children = index < items.length - 1 && items[index + 1].level > item.level;
    const aria_expanded = has_children ? 'aria-expanded="true"' : '';

    html += `
      <li role="treeitem" ${aria_expanded} aria-level="${item.level}" tabindex="${tabindex}" data-heading-id="${item.id}">
        <a href="#${item.id}" class="toc-link">${item.text}</a>
    `;

    // Don't close li yet if it will have children
    if (!has_children) {
      html += '</li>';
    }
  });

  // Close remaining open groups
  while (stack.length > 0) {
    stack.pop();
    html += '</ul>';
    if (stack.length > 0) {
      html += '</li>';
    }
  }

  return html;
}

// Render TOC in sidebar
function render_toc(items) {
  const toc_sidebar = document.getElementById('toc-sidebar');

  if (!toc_sidebar) {
    console.warn('TOC sidebar not found');
    return;
  }

  const toc_html = build_toc_html(items);

  // Sanitize before injection
  const clean_html = DOMPurify.sanitize(toc_html, {
    ALLOWED_TAGS: ['div', 'ul', 'li', 'a'],
    ALLOWED_ATTR: ['role', 'aria-level', 'tabindex', 'data-heading-id', 'href', 'class'],
    SANITIZE_NAMED_PROPS: true
  });

  toc_sidebar.innerHTML = clean_html;
}

// Render markdown content
async function render_content(content) {
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
    ADD_ATTR: ['class', 'id', 'data-original', 'type', 'disabled', 'checked'],
    SANITIZE_NAMED_PROPS: true  // Adds user-content- prefix to IDs
  });

  // Inject to DOM
  content_element.innerHTML = clean_html;

  // Post-sanitization: ensure only checkbox inputs remain
  const inputs = content_element.querySelectorAll('input');
  inputs.forEach(input => {
    if (input.type !== 'checkbox') input.remove();
    if (!input.hasAttribute('disabled')) input.setAttribute('disabled', 'disabled');
  });

  // Extract and render TOC (after DOMPurify, before highlight.js)
  const toc_items = extract_toc();
  render_toc(toc_items);

  // Apply syntax highlighting to code blocks
  if (window.hljs) {
    const code_blocks = content_element.querySelectorAll('pre code.hljs');
    code_blocks.forEach((block) => {
      window.hljs.highlightElement(block);
    });
  }

  // Render mermaid diagrams
  await render_mermaid();
}

// Show error message
function show_error(message) {
  const content_element = document.getElementById('content');
  content_element.innerHTML = `<div class="error-message">${DOMPurify.sanitize(message)}</div>`;
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

  // Receive errors from main process
  window.electronAPI.onError((message) => {
    show_error(message);
  });
}

init();
