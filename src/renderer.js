// Direct path required: Electron's <script type="module"> doesn't support bare specifiers
import GithubSlugger from '../node_modules/github-slugger/index.js';

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

// Module-level cache for scroll tracking
let cached_headings = [];  // { element, offset_top, id }
let active_toc_li = null;
let raf_pending = false;
let resize_timer = null;

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

// Extract heading text, removing task-list checkboxes
function extract_heading_text(heading) {
  const clone = heading.cloneNode(true);
  clone.querySelectorAll('input[type="checkbox"]').forEach(el => el.remove());
  return clone.textContent.trim();
}

// Escape HTML for safe injection
function escape_html(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Extract headings and generate TOC
function extract_and_render_toc(content_element) {
  active_toc_li = null;
  const toc_container = document.getElementById('toc-sidebar');
  if (!toc_container) {
    console.error('TOC container not found');
    return;
  }

  // Extract headings from sanitized DOM
  const headings = Array.from(content_element.querySelectorAll('h1, h2, h3, h4, h5, h6'));

  // Empty state
  if (headings.length === 0) {
    toc_container.innerHTML = '<div class="toc-empty">No headings found</div>';
    return;
  }

  // Generate IDs and build TOC data
  const slugger = new GithubSlugger();
  const toc_items = headings.map(heading => {
    const text = extract_heading_text(heading);

    // Generate safe ID with user-content- prefix
    const normalized = text.normalize('NFC');
    const slug = slugger.slug(normalized) || `heading-${Math.random().toString(36).substr(2, 9)}`;
    const id = `user-content-${slug}`;
    heading.setAttribute('id', id);

    return {
      id,
      text,
      level: parseInt(heading.tagName[1])
    };
  });

  // Build TOC HTML
  const toc_html = '<ul role="group">' + toc_items.map((item, index) =>
    `<li role="treeitem" aria-level="${item.level}" tabindex="${index === 0 ? '0' : '-1'}">` +
    `<a href="#${item.id}" title="${escape_html(item.text)}">${escape_html(item.text)}</a></li>`
  ).join('') + '</ul>';

  // Sanitize and inject
  const clean_toc = DOMPurify.sanitize(toc_html, {
    ALLOWED_TAGS: ['ul', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'role', 'aria-level', 'tabindex', 'class', 'title'],
    SANITIZE_NAMED_PROPS: true
  });

  toc_container.innerHTML = clean_toc;

  // Cache heading positions for scroll tracking
  cached_headings = toc_items.map(item => ({
    element: content_element.querySelector(`#${CSS.escape(item.id)}`),
    offset_top: 0,
    id: item.id
  })).filter(h => h.element !== null);
}

// Invalidate heading position cache
function invalidate_heading_cache() {
  const content_el = document.getElementById('content');
  if (!content_el) return;
  const container_offset = content_el.offsetTop;
  for (const entry of cached_headings) {
    entry.offset_top = entry.element.offsetTop - container_offset;
  }
}

// Throttled scroll tracking for TOC active state
let scroll_controller = null;

function setup_scroll_tracking() {
  // Cleanup previous listener
  if (scroll_controller) {
    scroll_controller.abort();
  }
  clearTimeout(resize_timer);
  scroll_controller = new AbortController();

  const content_element = document.getElementById('content');
  const toc_container = document.getElementById('toc-sidebar');

  if (!content_element || !toc_container) {
    console.error('Scroll tracking setup failed: missing content or TOC element');
    return;
  }

  function update_active_heading() {
    raf_pending = false;

    if (cached_headings.length === 0) return;

    // Find closest heading to viewport top
    const scroll_top = content_element.scrollTop;
    let active_id = cached_headings[0].id;

    for (const heading of cached_headings) {
      if (heading.offset_top <= scroll_top + 100) {
        active_id = heading.id;
      } else {
        break;
      }
    }

    // Update active class in TOC - only toggle 2 elements
    const new_active_link = toc_container.querySelector(`a[href="#${CSS.escape(active_id)}"]`);
    if (new_active_link) {
      const new_active_li = new_active_link.closest('li');
      if (new_active_li !== active_toc_li) {
        if (active_toc_li) {
          active_toc_li.classList.remove('active');
        }
        new_active_li.classList.add('active');
        active_toc_li = new_active_li;

        // Scroll TOC to show active item
        active_toc_li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  content_element.addEventListener('scroll', () => {
    if (!raf_pending) {
      raf_pending = true;
      requestAnimationFrame(update_active_heading);
    }
  }, { signal: scroll_controller.signal });

  // Invalidate cache on window resize (debounced)
  window.addEventListener('resize', () => {
    clearTimeout(resize_timer);
    resize_timer = setTimeout(invalidate_heading_cache, 150);
  }, { signal: scroll_controller.signal });
}

// ARIA keyboard navigation for TOC
let keyboard_controller = null;

function setup_toc_keyboard_nav() {
  // Cleanup previous listener
  if (keyboard_controller) {
    keyboard_controller.abort();
  }
  keyboard_controller = new AbortController();

  const toc_container = document.getElementById('toc-sidebar');
  if (!toc_container) {
    console.error('TOC keyboard navigation setup failed: TOC container not found');
    return;
  }

  toc_container.addEventListener('keydown', (e) => {
    const items = Array.from(toc_container.querySelectorAll('li[role="treeitem"]'));
    const current = document.activeElement.closest('li[role="treeitem"]');
    if (!current) return;

    const current_index = items.indexOf(current);
    let next_index = current_index;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        next_index = Math.min(current_index + 1, items.length - 1);
        break;

      case 'ArrowUp':
        e.preventDefault();
        next_index = Math.max(current_index - 1, 0);
        break;

      case 'Home':
        e.preventDefault();
        next_index = 0;
        break;

      case 'End':
        e.preventDefault();
        next_index = items.length - 1;
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        const link = current.querySelector('a');
        if (link) link.click();
        return;

      default:
        return;
    }

    // Update roving tabindex
    items.forEach((item, index) => {
      item.setAttribute('tabindex', index === next_index ? '0' : '-1');
    });

    // Move focus
    items[next_index].focus();
  }, { signal: keyboard_controller.signal });
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
    SANITIZE_NAMED_PROPS: true
  });

  // Inject to DOM
  content_element.innerHTML = clean_html;

  // Post-sanitization: ensure only checkbox inputs remain
  const inputs = content_element.querySelectorAll('input');
  inputs.forEach(input => {
    if (input.type !== 'checkbox') input.remove();
    if (!input.hasAttribute('disabled')) input.setAttribute('disabled', 'disabled');
  });

  // Extract and render TOC after DOM injection
  extract_and_render_toc(content_element);

  // Setup scroll tracking for TOC active state
  setup_scroll_tracking();

  // Setup ARIA keyboard navigation for TOC
  setup_toc_keyboard_nav();

  // Apply syntax highlighting to code blocks
  if (window.hljs) {
    const code_blocks = content_element.querySelectorAll('pre code.hljs');
    code_blocks.forEach((block) => {
      window.hljs.highlightElement(block);
    });
  }

  // Render mermaid diagrams
  await render_mermaid();

  // Invalidate heading cache after mermaid rendering shifts positions
  invalidate_heading_cache();
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

  // Toggle TOC sidebar
  function toggle_toc() {
    const toc_sidebar = document.getElementById('toc-sidebar');
    if (!toc_sidebar) {
      console.error('TOC toggle failed: sidebar element not found');
      return;
    }
    toc_sidebar.classList.toggle('toc-hidden');
  }

  // Toggle TOC sidebar on Cmd+Shift+O
  window.electronAPI.onToggleToc(toggle_toc);

  // Toggle TOC with button click
  const toc_toggle_btn = document.getElementById('toc-toggle');
  if (toc_toggle_btn) {
    toc_toggle_btn.addEventListener('click', toggle_toc);
  }
}

init();
