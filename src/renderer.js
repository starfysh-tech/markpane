// Direct path required: Electron's <script type="module"> doesn't support bare specifiers
import GithubSlugger from '../node_modules/github-slugger/index.js';

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

// Module-level cache for scroll tracking
let cached_headings = [];  // { element, offset_top, id }
let active_toc_li = null;
let raf_pending = false;
let resize_timer = null;

// Settings state
let current_settings = {
  theme: 'system',
  bodyFont: 'San Francisco',
  bodyFontSize: '16',
  codeFont: 'SF Mono',
  codeFontSize: '14'
};

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
      const error_div = document.createElement('div');
      error_div.className = 'mermaid-error';
      error_div.textContent = `Diagram error: ${err.message}`;
      element.innerHTML = '';
      element.appendChild(error_div);
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
          <pre>${escaped_frontmatter}</pre>
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
  } catch (err) {
    console.error('Render failed:', err);
    const content_element = document.getElementById('content');
    if (content_element) {
      content_element.textContent = `Render error: ${err.message}`;
    }
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

// Get font-family CSS for a given font name and category
function get_font_family_css(font_name, category) {
  if (category === 'proportional') {
    if (font_name === 'San Francisco') {
      return '-apple-system, BlinkMacSystemFont, sans-serif';
    }
    return `"${font_name}", sans-serif`;
  } else if (category === 'mono') {
    if (font_name === 'SF Mono') {
      return 'ui-monospace, SFMono-Regular, "SF Mono", monospace';
    }
    return `"${font_name}", monospace`;
  }
  return '';
}

// Populate custom font dropdown with system fonts
function populate_font_select(select_el, font_list, category) {
  if (!select_el || !font_list) return;

  const dropdown = select_el.querySelector('.custom-select-dropdown');
  if (!dropdown) return;

  // Clear existing options
  dropdown.innerHTML = '';

  // Create option elements
  for (const font_name of font_list) {
    const option = document.createElement('div');
    option.className = 'custom-select-option';
    option.setAttribute('data-value', font_name);
    option.setAttribute('role', 'option');
    option.textContent = font_name;

    // Apply font-family for live preview
    option.style.fontFamily = get_font_family_css(font_name, category);

    dropdown.appendChild(option);
  }
}

// Ensure a font option exists in the dropdown (for saved fonts that may be uninstalled)
function ensure_font_option(select_el, font_name, category) {
  if (!select_el || !font_name) return;

  const dropdown = select_el.querySelector('.custom-select-dropdown');
  if (!dropdown) return;

  // Check if option already exists
  const existing = dropdown.querySelector(`[data-value="${font_name}"]`);
  if (existing) return;

  // Add missing font with "(not installed)" suffix
  const option = document.createElement('div');
  option.className = 'custom-select-option';
  option.setAttribute('data-value', font_name);
  option.setAttribute('role', 'option');
  option.textContent = `${font_name} (not installed)`;
  option.style.fontFamily = get_font_family_css(font_name, category);

  dropdown.appendChild(option);
}

// Get selected value from custom dropdown
function get_custom_select_value(select_el) {
  if (!select_el) return '';
  const value_span = select_el.querySelector('.custom-select-value');
  return value_span ? value_span.getAttribute('data-value') || '' : '';
}

// Set selected value in custom dropdown
function set_custom_select_value(select_el, value, category) {
  if (!select_el) return;

  const value_span = select_el.querySelector('.custom-select-value');
  const dropdown = select_el.querySelector('.custom-select-dropdown');

  if (value_span) {
    value_span.textContent = value;
    value_span.setAttribute('data-value', value);
    // Apply font to trigger for preview
    value_span.style.fontFamily = get_font_family_css(value, category);
  }

  // Update selected state in options
  if (dropdown) {
    dropdown.querySelectorAll('.custom-select-option').forEach(opt => {
      opt.classList.toggle('selected', opt.getAttribute('data-value') === value);
    });
  }
}

// Setup custom dropdown interactions
function setup_custom_select(select_el, on_change) {
  if (!select_el) return;

  const trigger = select_el.querySelector('.custom-select-trigger');
  const dropdown = select_el.querySelector('.custom-select-dropdown');
  const category = select_el.getAttribute('data-category');

  if (!trigger || !dropdown) return;

  let focused_index = -1;

  // Toggle dropdown on trigger click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const is_open = select_el.classList.contains('open');

    // Close all other dropdowns
    document.querySelectorAll('.custom-select.open').forEach(el => {
      if (el !== select_el) {
        el.classList.remove('open');
        el.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
      }
    });

    // Toggle this dropdown
    select_el.classList.toggle('open');
    trigger.setAttribute('aria-expanded', !is_open);

    if (!is_open) {
      // Scroll to selected option
      const selected = dropdown.querySelector('.custom-select-option.selected');
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
      focused_index = -1;
    }
  });

  // Handle option selection
  dropdown.addEventListener('click', (e) => {
    const option = e.target.closest('.custom-select-option');
    if (!option) return;

    const value = option.getAttribute('data-value');
    set_custom_select_value(select_el, value, category);
    select_el.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');

    if (on_change) {
      on_change(value);
    }
  });

  // Keyboard navigation
  trigger.addEventListener('keydown', (e) => {
    const is_open = select_el.classList.contains('open');
    const options = Array.from(dropdown.querySelectorAll('.custom-select-option'));

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!is_open) {
          select_el.classList.add('open');
          trigger.setAttribute('aria-expanded', 'true');
          focused_index = options.findIndex(opt => opt.classList.contains('selected'));
        } else if (focused_index >= 0) {
          const value = options[focused_index].getAttribute('data-value');
          set_custom_select_value(select_el, value, category);
          select_el.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
          if (on_change) on_change(value);
        }
        break;

      case 'Escape':
        if (is_open) {
          e.preventDefault();
          select_el.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
          focused_index = -1;
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (!is_open) {
          select_el.classList.add('open');
          trigger.setAttribute('aria-expanded', 'true');
          focused_index = options.findIndex(opt => opt.classList.contains('selected'));
        } else {
          focused_index = Math.min(focused_index + 1, options.length - 1);
          options.forEach((opt, i) => opt.classList.toggle('focused', i === focused_index));
          if (options[focused_index]) {
            options[focused_index].scrollIntoView({ block: 'nearest' });
          }
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (is_open) {
          focused_index = Math.max(focused_index - 1, 0);
          options.forEach((opt, i) => opt.classList.toggle('focused', i === focused_index));
          if (options[focused_index]) {
            options[focused_index].scrollIntoView({ block: 'nearest' });
          }
        }
        break;

      default:
        // Type-ahead: jump to first option starting with pressed key
        if (is_open && e.key.length === 1 && e.key.match(/[a-z]/i)) {
          const letter = e.key.toLowerCase();
          const idx = options.findIndex(opt =>
            opt.getAttribute('data-value').toLowerCase().startsWith(letter)
          );
          if (idx >= 0) {
            focused_index = idx;
            options.forEach((opt, i) => opt.classList.toggle('focused', i === focused_index));
            options[focused_index].scrollIntoView({ block: 'nearest' });
          }
        }
        return;
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!select_el.contains(e.target)) {
      select_el.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      focused_index = -1;
    }
  });
}

// Apply settings (theme and fonts)
function apply_settings(settings) {
  current_settings = settings;
  const content_el = document.getElementById('content');

  // Apply theme
  if (settings.theme === 'system') {
    // Use system preference
    const prefers_dark = get_prefers_dark();
    document.body.classList.toggle('theme-dark', prefers_dark);
    document.body.classList.toggle('theme-light', !prefers_dark);
  } else if (settings.theme === 'dark') {
    document.body.classList.add('theme-dark');
    document.body.classList.remove('theme-light');
  } else if (settings.theme === 'light') {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
  }

  // Apply fonts
  if (content_el) {
    // Body font - map San Francisco to -apple-system
    const body_font = settings.bodyFont === 'San Francisco'
      ? '-apple-system, BlinkMacSystemFont'
      : `"${settings.bodyFont}"`;
    const body_fallback = ', "Segoe UI", Helvetica, Arial, sans-serif';

    // Apply body font and size via CSS custom properties
    content_el.style.setProperty('--custom-body-font', body_font + body_fallback);
    content_el.style.setProperty('--custom-body-font-size', (settings.bodyFontSize || '16') + 'px');

    // Code font - map SF Mono to system monospace stack
    const code_font = settings.codeFont === 'SF Mono'
      ? 'ui-monospace, SFMono-Regular, "SF Mono"'
      : `"${settings.codeFont}"`;
    const code_fallback = ', Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

    // Apply code font and size via CSS custom properties
    content_el.style.setProperty('--custom-code-font', code_font + code_fallback);
    content_el.style.setProperty('--custom-code-font-size', (settings.codeFontSize || '14') + 'px');
  }

  // Re-initialize mermaid with new theme
  const prefers_dark = document.body.classList.contains('theme-dark');
  init_mermaid(prefers_dark);
}

// Drag-and-drop file opening
function setup_drag_drop() {
  let drag_counter = 0;
  const overlay = document.getElementById('drop-overlay');

  if (!overlay) {
    console.warn('Drop overlay element not found, drag-drop disabled');
    return;
  }

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
  apply_settings(current_settings);

  // Listen for theme changes (only in UI mode, and only if using system theme)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    if (is_pdf_mode || current_settings.theme !== 'system') return;
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
      document.getElementById('filename').textContent = filename + ' - MarkPane';
    }
    await render_content(content);
  });

  // Auto-reload on file change
  window.electronAPI.onFileChanged(async (content, filename) => {
    if (is_pdf_mode) return;

    try {
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
    } catch (err) {
      console.error('File change handling failed:', err);
    }
  });

  // Receive errors from main process
  window.electronAPI.onError((message) => {
    show_error(message);
  });

  // Always-on-top indicator
  window.electronAPI.onAlwaysOnTopChanged((is_pinned) => {
    const indicator = document.getElementById('pin-indicator');
    if (!indicator) return;
    indicator.classList.toggle('visible', is_pinned);
  });

  // Setup drag-and-drop
  setup_drag_drop();

  // Toggle TOC sidebar
  function toggle_toc() {
    const toc_sidebar = document.getElementById('toc-sidebar');
    if (toc_sidebar) {
      toc_sidebar.classList.toggle('toc-hidden');
    }
  }

  // Toggle TOC sidebar on Cmd+Shift+O
  window.electronAPI.onToggleToc(toggle_toc);

  // Toggle TOC with button click
  const toc_toggle_btn = document.getElementById('toc-toggle');
  if (toc_toggle_btn) {
    toc_toggle_btn.addEventListener('click', toggle_toc);
  }

  // Toggle settings on Cmd+,
  window.electronAPI.onToggleSettings(toggle_settings_panel);

  // Find in page
  const find_bar = document.getElementById('find-bar');
  const find_input = document.getElementById('find-input');
  const find_count = document.getElementById('find-count');
  const find_close = document.getElementById('find-close');

  function show_find_bar() {
    if (!find_bar || !find_input) return;
    find_bar.classList.add('visible');
    find_input.focus();
    find_input.select();
  }

  function hide_find_bar() {
    if (!find_bar) return;
    find_bar.classList.remove('visible');
    if (find_input) find_input.blur();
    window.electronAPI.stopFind('clearSelection');
    if (find_count) {
      find_count.textContent = '';
    }
  }

  // Listen for Cmd+F from menu
  window.electronAPI.onShowFind(show_find_bar);

  // Search on input
  if (find_input) {
    find_input.addEventListener('input', (e) => {
      const query = e.target.value;
      if (query.length === 0) {
        window.electronAPI.stopFind('clearSelection');
        if (find_count) {
          find_count.textContent = '';
        }
      } else {
        window.electronAPI.findText(query);
      }
    });

    // Close on Escape
    find_input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        hide_find_bar();
      }
    });
  }

  // Update match count
  window.electronAPI.onFoundInPage((result) => {
    if (!find_count) return;
    if (result.matches > 0) {
      find_count.textContent = `${result.activeMatchOrdinal}/${result.matches}`;
    } else if (find_input && find_input.value.length > 0) {
      find_count.textContent = 'No matches';
    } else {
      find_count.textContent = '';
    }
  });

  // Close button
  if (find_close) {
    find_close.addEventListener('click', hide_find_bar);
  }

  // Settings panel
  const settings_panel = document.getElementById('settings-panel');
  const settings_toggle_btn = document.getElementById('settings-toggle');
  const theme_select = document.getElementById('theme-select');
  const body_font_select = document.getElementById('body-font-select');
  const body_font_size_select = document.getElementById('body-font-size-select');
  const code_font_select = document.getElementById('code-font-select');
  const code_font_size_select = document.getElementById('code-font-size-select');

  function show_settings_panel() {
    if (!settings_panel) return;
    settings_panel.classList.add('visible');
  }

  function hide_settings_panel() {
    if (!settings_panel) return;
    settings_panel.classList.remove('visible');
  }

  function toggle_settings_panel() {
    if (!settings_panel) return;
    settings_panel.classList.toggle('visible');
  }

  // Listen for system fonts from main process (sent before settings)
  window.electronAPI.onSystemFonts((fonts) => {
    populate_font_select(body_font_select, fonts.body, 'proportional');
    populate_font_select(code_font_select, fonts.mono, 'mono');
  });

  // Listen for initial settings from main process
  window.electronAPI.onSettings(async (settings) => {
    apply_settings(settings);
    // Update UI
    if (theme_select) theme_select.value = settings.theme;
    if (body_font_select) {
      ensure_font_option(body_font_select, settings.bodyFont || 'San Francisco', 'proportional');
      set_custom_select_value(body_font_select, settings.bodyFont || 'San Francisco', 'proportional');
    }
    if (body_font_size_select) body_font_size_select.value = settings.bodyFontSize || '16';
    if (code_font_select) {
      ensure_font_option(code_font_select, settings.codeFont || 'SF Mono', 'mono');
      set_custom_select_value(code_font_select, settings.codeFont || 'SF Mono', 'mono');
    }
    if (code_font_size_select) code_font_size_select.value = settings.codeFontSize || '14';
    // Re-render mermaid if theme override is active
    if (settings.theme !== 'system') {
      await rerender_mermaid_with_theme();
    }
  });

  // Listen for settings changes from other windows
  window.electronAPI.onSettingsChanged(async (settings) => {
    apply_settings(settings);
    // Update UI
    if (theme_select) theme_select.value = settings.theme;
    if (body_font_select) {
      ensure_font_option(body_font_select, settings.bodyFont || 'San Francisco', 'proportional');
      set_custom_select_value(body_font_select, settings.bodyFont || 'San Francisco', 'proportional');
    }
    if (body_font_size_select) body_font_size_select.value = settings.bodyFontSize || '16';
    if (code_font_select) {
      ensure_font_option(code_font_select, settings.codeFont || 'SF Mono', 'mono');
      set_custom_select_value(code_font_select, settings.codeFont || 'SF Mono', 'mono');
    }
    if (code_font_size_select) code_font_size_select.value = settings.codeFontSize || '14';
    // Re-render mermaid with new theme
    await rerender_mermaid_with_theme();
  });

  // Gear button click
  if (settings_toggle_btn) {
    settings_toggle_btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle_settings_panel();
    });
  }

  // Click outside to close
  document.addEventListener('click', (e) => {
    if (settings_panel &&
        settings_panel.classList.contains('visible') &&
        !settings_panel.contains(e.target) &&
        e.target !== settings_toggle_btn) {
      hide_settings_panel();
    }
  });

  // Theme select change
  if (theme_select) {
    theme_select.addEventListener('change', async (e) => {
      const new_settings = { ...current_settings, theme: e.target.value };
      apply_settings(new_settings);
      window.electronAPI.saveSettings(new_settings);
      // Re-render mermaid with new theme
      await rerender_mermaid_with_theme();
    });
  }

  // Setup custom font dropdowns
  if (body_font_select) {
    setup_custom_select(body_font_select, (value) => {
      const new_settings = { ...current_settings, bodyFont: value };
      apply_settings(new_settings);
      window.electronAPI.saveSettings(new_settings);
    });
  }

  if (code_font_select) {
    setup_custom_select(code_font_select, (value) => {
      const new_settings = { ...current_settings, codeFont: value };
      apply_settings(new_settings);
      window.electronAPI.saveSettings(new_settings);
    });
  }

  // Body font size select change
  if (body_font_size_select) {
    body_font_size_select.addEventListener('change', (e) => {
      const new_settings = { ...current_settings, bodyFontSize: e.target.value };
      apply_settings(new_settings);
      window.electronAPI.saveSettings(new_settings);
    });
  }

  // Code font size select change
  if (code_font_size_select) {
    code_font_size_select.addEventListener('change', (e) => {
      const new_settings = { ...current_settings, codeFontSize: e.target.value };
      apply_settings(new_settings);
      window.electronAPI.saveSettings(new_settings);
    });
  }

  // Global escape handler - close window if no panels are open
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const find_visible = find_bar && find_bar.classList.contains('visible');
      const settings_visible = settings_panel && settings_panel.classList.contains('visible');

      if (settings_visible) {
        e.stopPropagation();
        hide_settings_panel();
      } else if (find_visible) {
        hide_find_bar();
      } else {
        // No panels open - quit app
        window.electronAPI.quitApp();
      }
    }
  });
}

init();
