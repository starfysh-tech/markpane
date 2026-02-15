// Initialize markdown-it with custom fence renderer
const md = window.markdownit({ html: true, linkify: true, typographer: true });

// Add task lists plugin (read-only checkboxes)
md.use(window.markdownitTaskLists, { enabled: false, label: false });

// Store default fence renderer
const default_fence = md.renderer.rules.fence.bind(md.renderer.rules);

// Custom fence: convert ```mermaid to <div class="mermaid">, add language classes for others
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const info = token.info.trim();

  if (info === 'mermaid') {
    return `<div class="mermaid">${md.utils.escapeHtml(token.content)}</div>`;
  }

  // Add language-{lang} class for syntax highlighting
  if (info) {
    const lang = info.split(/\s+/)[0];
    if (lang) {
      token.attrJoin('class', `language-${lang}`);
      token.attrJoin('class', 'hljs');
    }
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

  // Re-highlight code blocks with new theme
  // Remove hljs-processed class to allow re-highlighting
  const code_blocks = document.querySelectorAll('pre code.hljs-processed');
  code_blocks.forEach((block) => {
    block.classList.remove('hljs-processed');
  });
  highlight_code_blocks();
}

// Highlight code blocks with highlight.js
function highlight_code_blocks() {
  const code_blocks = document.querySelectorAll('pre code');

  code_blocks.forEach((block) => {
    // Skip if already highlighted or if it's a mermaid block
    if (block.classList.contains('hljs-processed') || block.closest('.mermaid')) {
      return;
    }

    // If language class exists, use specific highlighting
    if (block.className.includes('language-')) {
      if (window.hljs) {
        hljs.highlightElement(block);
        block.classList.add('hljs-processed');
      }
      return;
    }

    // Auto-detect language for unlabeled blocks
    if (window.hljs) {
      const result = hljs.highlightAuto(block.textContent);
      block.innerHTML = result.value;
      block.classList.add('hljs');
      block.classList.add('hljs-processed');
      if (result.language) {
        block.classList.add(`language-${result.language}`);
      }
    }
  });
}

// Add copy buttons to code blocks
function add_copy_buttons() {
  const pre_blocks = document.querySelectorAll('pre');

  pre_blocks.forEach((pre) => {
    // Skip if it's a mermaid block or already has a copy button
    if (pre.querySelector('.mermaid') || pre.querySelector('.copy-button')) {
      return;
    }

    // Add position relative to pre for absolute positioning
    pre.style.position = 'relative';

    // Create copy button
    const copy_button = document.createElement('button');
    copy_button.className = 'copy-button';
    copy_button.textContent = 'Copy';
    copy_button.setAttribute('aria-label', 'Copy code to clipboard');

    copy_button.addEventListener('click', async () => {
      const code = pre.querySelector('code');
      if (!code) return;

      try {
        await navigator.clipboard.writeText(code.textContent);
        copy_button.textContent = 'Copied!';
        copy_button.classList.add('copied');

        setTimeout(() => {
          copy_button.textContent = 'Copy';
          copy_button.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });

    pre.appendChild(copy_button);
  });
}

// Search state
let search_matches = [];
let current_match_index = -1;

// Clear search highlights
function clear_search_highlights() {
  const marks = document.querySelectorAll('mark.search-highlight');
  marks.forEach(mark => {
    const parent = mark.parentNode;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize(); // Merge adjacent text nodes
  });
  search_matches = [];
  current_match_index = -1;
}

// Search and highlight matches
function search_in_content(query) {
  clear_search_highlights();

  if (!query) {
    return;
  }

  const content_element = document.getElementById('content');
  const tree_walker = document.createTreeWalker(
    content_element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip script/style/mermaid elements
        const parent = node.parentElement;
        if (parent && (
          parent.tagName === 'SCRIPT' ||
          parent.tagName === 'STYLE' ||
          parent.classList.contains('mermaid') ||
          parent.closest('.mermaid')
        )) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const text_nodes = [];
  let node;
  while (node = tree_walker.nextNode()) {
    text_nodes.push(node);
  }

  const query_lower = query.toLowerCase();

  text_nodes.forEach(text_node => {
    const text = text_node.textContent;
    const text_lower = text.toLowerCase();
    let start_index = 0;
    const matches = [];

    while (true) {
      const index = text_lower.indexOf(query_lower, start_index);
      if (index === -1) break;
      matches.push({ start: index, end: index + query.length });
      start_index = index + 1;
    }

    if (matches.length === 0) return;

    const parent = text_node.parentNode;
    const fragment = document.createDocumentFragment();
    let last_index = 0;

    matches.forEach(match => {
      // Add text before match
      if (match.start > last_index) {
        fragment.appendChild(document.createTextNode(text.substring(last_index, match.start)));
      }

      // Add highlighted match
      const mark = document.createElement('mark');
      mark.className = 'search-highlight';
      mark.textContent = text.substring(match.start, match.end);
      fragment.appendChild(mark);
      search_matches.push(mark);

      last_index = match.end;
    });

    // Add remaining text
    if (last_index < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(last_index)));
    }

    parent.replaceChild(fragment, text_node);
  });

  // Update counter
  update_search_counter();

  // Jump to first match
  if (search_matches.length > 0) {
    current_match_index = 0;
    scroll_to_match(current_match_index);
  }
}

// Update search counter display
function update_search_counter() {
  const counter = document.getElementById('search-counter');
  if (search_matches.length === 0) {
    counter.textContent = 'No matches';
  } else {
    counter.textContent = `${current_match_index + 1} of ${search_matches.length}`;
  }
}

// Scroll to specific match
function scroll_to_match(index) {
  if (index < 0 || index >= search_matches.length) return;

  // Remove active class from all matches
  search_matches.forEach(mark => mark.classList.remove('active'));

  // Add active class to current match
  const match = search_matches[index];
  match.classList.add('active');
  match.scrollIntoView({ behavior: 'smooth', block: 'center' });

  update_search_counter();
}

// Navigate to next match
function next_match() {
  if (search_matches.length === 0) return;
  current_match_index = (current_match_index + 1) % search_matches.length;
  scroll_to_match(current_match_index);
}

// Navigate to previous match
function prev_match() {
  if (search_matches.length === 0) return;
  current_match_index = (current_match_index - 1 + search_matches.length) % search_matches.length;
  scroll_to_match(current_match_index);
}

// TOC generation and scroll spy
let toc_observer = null;

function generate_toc() {
  const toc_content = document.getElementById('toc-content');
  const content_element = document.getElementById('content');
  const headings = content_element.querySelectorAll('h1, h2, h3, h4, h5, h6');

  if (headings.length === 0) {
    toc_content.innerHTML = '<div class="toc-empty">No headings found</div>';
    return;
  }

  // Disconnect existing observer
  if (toc_observer) {
    toc_observer.disconnect();
  }

  const toc_list = document.createElement('ul');
  toc_list.className = 'toc-list';

  headings.forEach((heading, index) => {
    // Add ID to heading if missing
    if (!heading.id) {
      heading.id = `heading-${index}`;
    }

    const level = parseInt(heading.tagName[1]);
    const item = document.createElement('li');
    item.className = `toc-item toc-level-${level}`;
    item.setAttribute('data-heading-id', heading.id);

    const link = document.createElement('a');
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    link.className = 'toc-link';

    link.addEventListener('click', (e) => {
      e.preventDefault();
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    item.appendChild(link);
    toc_list.appendChild(item);
  });

  toc_content.innerHTML = '';
  toc_content.appendChild(toc_list);

  // Setup IntersectionObserver for scroll spy
  toc_observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        const id = entry.target.id;
        const toc_item = toc_content.querySelector(`[data-heading-id="${id}"]`);

        if (entry.isIntersecting) {
          // Remove active from all items
          toc_content.querySelectorAll('.toc-item').forEach(item => {
            item.classList.remove('active');
          });
          // Add active to current item
          if (toc_item) {
            toc_item.classList.add('active');
          }
        }
      });
    },
    {
      rootMargin: '-38px 0px -80% 0px',
      threshold: 0
    }
  );

  headings.forEach(heading => {
    toc_observer.observe(heading);
  });
}

// Render markdown content
async function render_content(content) {
  const content_element = document.getElementById('content');

  // Clear search state
  clear_search_highlights();
  const search_input = document.getElementById('search-input');
  if (search_input) {
    search_input.value = '';
  }
  const search_counter = document.getElementById('search-counter');
  if (search_counter) {
    search_counter.textContent = '';
  }

  // Parse markdown
  const html = md.render(content);

  // Sanitize with DOMPurify
  const clean_html = DOMPurify.sanitize(html, {
    ADD_TAGS: ['div', 's'],
    ADD_ATTR: ['class', 'data-original', 'type', 'disabled', 'checked']
  });

  // Inject to DOM
  content_element.innerHTML = clean_html;

  // Highlight code blocks (after sanitization, before mermaid)
  highlight_code_blocks();

  // Render mermaid diagrams
  await render_mermaid();

  // Add copy buttons to code blocks
  add_copy_buttons();

  // Regenerate TOC
  generate_toc();
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
  // Show/hide AI badge
  function toggle_ai_badge(show) {
    const badge = document.getElementById('ai-badge');
    if (badge) {
      badge.style.display = show ? 'flex' : 'none';
    }
  }

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
  window.electronAPI.onFileContent(async (content, filename, pdf_mode, is_ai_file) => {
    is_pdf_mode = pdf_mode;

    // Force light theme for PDF export
    if (is_pdf_mode) {
      setup_theme(true);
    }

    // Hide pin button in PDF mode
    const pin_button = document.getElementById('pin-button');
    if (pin_button) {
      pin_button.style.display = pdf_mode ? 'none' : 'flex';

    // Show AI badge if this is an AI context file
    toggle_ai_badge(is_ai_file && !pdf_mode);
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

  // Pin button click handler
  const pin_button = document.getElementById('pin-button');
  if (pin_button) {
    pin_button.addEventListener('click', () => {
      window.electronAPI.togglePin();
    });
  }

  // Pin state change handler
  window.electronAPI.onPinStateChanged((is_pinned) => {
    const pin_button = document.getElementById('pin-button');
    if (pin_button) {
      pin_button.classList.toggle('pinned', is_pinned);
      pin_button.setAttribute('aria-pressed', is_pinned.toString());
    }
  });

  // Search bar handlers
  const search_bar = document.getElementById('search-bar');
  const search_input = document.getElementById('search-input');
  const search_close = document.getElementById('search-close');
  const search_next_btn = document.getElementById('search-next');
  const search_prev_btn = document.getElementById('search-prev');

  window.electronAPI.onToggleSearch(() => {
    if (search_bar.classList.contains('hidden')) {
      // Open search
      search_bar.classList.remove('hidden');
      search_input.focus();
    } else {
      // Close search
      search_bar.classList.add('hidden');
      clear_search_highlights();
    }
  });

  window.electronAPI.onSearchNext(() => {
    next_match();
  });

  window.electronAPI.onSearchPrev(() => {
    prev_match();
  });

  search_input.addEventListener('input', (e) => {
    search_in_content(e.target.value);
  });

  search_input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        prev_match();
      } else {
        next_match();
      }
    } else if (e.key === 'Escape') {
      window.electronAPI.toggleSearch();
    }
  });

  search_close.addEventListener('click', () => {
    window.electronAPI.toggleSearch();
  });

  search_next_btn.addEventListener('click', () => {
    next_match();
  });

  search_prev_btn.addEventListener('click', () => {
    prev_match();
  });

  // TOC handlers
  const toc_sidebar = document.getElementById('toc-sidebar');
  const toc_button = document.getElementById('toc-button');
  const content_element = document.getElementById('content');

  // Restore TOC state
  window.electronAPI.getTocVisible().then((is_visible) => {
    if (is_visible) {
      toc_sidebar.classList.remove('hidden');
      content_element.classList.add('toc-open');
      toc_button.classList.add('active');
    }
  });

  window.electronAPI.onToggleTOC(() => {
    const is_hidden = toc_sidebar.classList.contains('hidden');
    if (is_hidden) {
      toc_sidebar.classList.remove('hidden');
      content_element.classList.add('toc-open');
      toc_button.classList.add('active');
      window.electronAPI.setTocVisible(true);
    } else {
      toc_sidebar.classList.add('hidden');
      content_element.classList.remove('toc-open');
      toc_button.classList.remove('active');
      window.electronAPI.setTocVisible(false);
    }
  });

  toc_button.addEventListener('click', () => {
    window.electronAPI.toggleTOC();
  });

  // File changed handler (for AI context files)
  window.electronAPI.onFileChanged(async (content) => {
    await render_content(content);
  });

  // Context menu handler
  document.addEventListener('contextmenu', (e) => {
    const selection = window.getSelection();
    const selection_text = selection.toString().trim();
    const has_selection = selection_text.length > 0;

    window.electronAPI.showContextMenu({
      selection_text,
      has_selection
    });
  });

  // Copy as HTML handler
  window.electronAPI.onCopyAsHTML(async () => {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());

    const html = container.innerHTML;
    try {
      await navigator.clipboard.writeText(html);
    } catch (err) {
      console.error('Failed to copy HTML:', err);
    }
  });
}

init();
