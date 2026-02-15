const { app, BrowserWindow, dialog, globalShortcut, Menu, ipcMain } = require('electron');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

let display_name = 'MarkPane';
let main_window = null;
let file_content = null;
let error_message = null;
let quicklook_debug = false;
let file_watcher = null;

// File watching with debounce
let reload_debounce = null;

// Helper: safe send to renderer
function send_to_renderer(channel, ...args) {
  if (main_window && !main_window.isDestroyed()) {
    main_window.webContents.send(channel, ...args);
  }
}

function reload_file() {
  if (!file_path || !fs.existsSync(file_path)) {
    return;
  }

  try {
    const new_content = fs.readFileSync(file_path, 'utf-8');
    if (new_content !== file_content) {
      file_content = new_content;
      send_to_renderer('file-changed', file_content, display_name);
    }
  } catch (err) {
    console.warn('File reload failed:', err.message);
    send_to_renderer('error', `Live reload failed: ${err.message}`);
  }
}

function start_file_watcher() {
  if (!file_path || file_watcher) {
    return;
  }

  try {
    // Capture file_path by value to prevent stale closure bug
    const watched_path = file_path;
    file_watcher = fs.watch(watched_path, { persistent: false }, (event_type) => {
      // Debounce rapid changes (atomic writes, multiple saves)
      if (reload_debounce) {
        clearTimeout(reload_debounce);
      }

      reload_debounce = setTimeout(() => {
        // Check if file still exists before reloading
        if (fs.existsSync(watched_path)) {
          reload_file();
        } else {
          // File deleted
          stop_file_watcher();
          send_to_renderer('error', 'File was deleted');
        }
      }, 300);
    });

    file_watcher.on('error', (err) => {
      console.warn('File watcher error:', err.message);
      send_to_renderer('error', `File watch error: ${err.message}`);
      stop_file_watcher();
    });
  } catch (err) {
    console.warn('Failed to start file watcher:', err.message);
    send_to_renderer('error', `Failed to watch file: ${err.message}`);
  }
}

function stop_file_watcher() {
  if (file_watcher) {
    try {
      file_watcher.close();
    } catch (err) {
      console.warn('Error closing file watcher:', err.message);
    }
    file_watcher = null;
  }

  if (reload_debounce) {
    clearTimeout(reload_debounce);
    reload_debounce = null;
  }
}

// Parse CLI args
const args = process.argv.slice(2);
let file_path = null;
let pdf_output = null;
let show_version = false;
let uninstall_quicklook_flag = false;
let uninstall_all_flag = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--pdf' && args[i + 1]) {
    pdf_output = args[i + 1];
    i++; // Skip next arg
  } else if (args[i] === '--version' || args[i] === '-v') {
    show_version = true;
  } else if (args[i] === '--ql-debug' || args[i] === '--quicklook-debug') {
    quicklook_debug = true;
  } else if (args[i] === '--uninstall-quicklook') {
    uninstall_quicklook_flag = true;
  } else if (args[i] === '--uninstall-all') {
    uninstall_all_flag = true;
  } else if (!args[i].startsWith('--')) {
    file_path = args[i];
  }
}

function show_help() {
  const pkg = require('../package.json');
  console.log(`
${pkg.name} v${pkg.version}
${pkg.description}

Usage:
  markpane <file.md>                View markdown file
  markpane <file.md> --pdf out.pdf  Export to PDF

Options:
  -h, --help      Show this help message
  -v, --version   Show version number
  --ql-debug      Enable Quick Look telemetry logging
  --uninstall-quicklook  Remove the Quick Look extension
  --uninstall-all  Remove MarkPane and its Quick Look extension

Shortcuts:
  Escape          Close window
  Cmd/Ctrl+W      Close window
  Cmd/Ctrl+Shift+A  Toggle always-on-top
`);
  process.exit(0);
}

const is_mac = process.platform === 'darwin';
const is_packaged = app.isPackaged;
const is_help = args.includes('--help') || args.includes('-h');

// Handle help and version
if ((args.length === 0 && !is_packaged) || is_help) {
  show_help();
}

if (show_version) {
  const pkg = require('../package.json');
  console.log(pkg.version);
  process.exit(0);
}

const is_cli_mode = !!file_path || !!pdf_output || show_version || uninstall_quicklook_flag || uninstall_all_flag;

// Read input file
if (!file_path) {
  if (is_cli_mode) {
    error_message = 'No markdown file specified.\nUsage: markpane <file.md> [--pdf output.pdf]\nRun markpane --help for more options.';
  }
} else if (!fs.existsSync(file_path)) {
  error_message = `File not found: ${file_path}`;
} else {
  try {
    file_content = fs.readFileSync(file_path, 'utf-8');
    display_name = path.basename(file_path);
  } catch (err) {
    error_message = `Failed to read file: ${err.message}`;
  }
}

function get_app_bundle_path() {
  if (!is_mac || !is_packaged) {
    return null;
  }
  return path.resolve(app.getPath('exe'), '../../..');
}

function get_applications_location() {
  const bundle_path = get_app_bundle_path();
  if (!bundle_path) {
    return null;
  }
  const applications_path = path.join('/Applications', path.sep);
  const user_applications_path = path.join(os.homedir(), 'Applications', path.sep);
  if (bundle_path.startsWith(applications_path)) {
    return '/Applications';
  }
  if (bundle_path.startsWith(user_applications_path)) {
    return path.join(os.homedir(), 'Applications');
  }
  return null;
}

function is_quicklook_debug_enabled() {
  if (quicklook_debug) {
    return true;
  }
  const env_value = process.env.MARKPANE_QL_DEBUG;
  if (!env_value) {
    return false;
  }
  return env_value === '1' || env_value.toLowerCase() === 'true';
}

function now_ms() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function create_quicklook_telemetry() {
  if (!is_quicklook_debug_enabled()) {
    return null;
  }
  ensure_quicklook_debug_flag();
  return {
    started_at: new Date().toISOString(),
    app_version: app.getVersion(),
    app_path: get_app_bundle_path(),
    is_packaged: is_packaged,
    steps: [],
    events: [],
    outcome: 'unknown'
  };
}

function record_step(telemetry, name, fn) {
  if (!telemetry) {
    return fn();
  }
  const start = now_ms();
  try {
    const result = fn();
    telemetry.steps.push({ name, duration_ms: Math.round(now_ms() - start) });
    return result;
  } catch (err) {
    telemetry.steps.push({
      name,
      duration_ms: Math.round(now_ms() - start),
      error: err && err.message ? err.message : String(err)
    });
    throw err;
  }
}

function record_event(telemetry, name, data) {
  if (!telemetry) {
    return;
  }
  telemetry.events.push({
    name,
    at: new Date().toISOString(),
    data: data || null
  });
}

function write_quicklook_telemetry(telemetry) {
  if (!telemetry) {
    return;
  }
  try {
    const log_path = path.join(app.getPath('userData'), 'quicklook-telemetry.json');
    fs.mkdirSync(path.dirname(log_path), { recursive: true });
    let entries = [];
    if (fs.existsSync(log_path)) {
      const raw = fs.readFileSync(log_path, 'utf-8');
      entries = JSON.parse(raw);
      if (!Array.isArray(entries)) {
        entries = [];
      }
    }
    entries.push(telemetry);
    if (entries.length > 50) {
      entries = entries.slice(entries.length - 50);
    }
    fs.writeFileSync(log_path, JSON.stringify(entries, null, 2));
  } catch (err) {
    console.warn('Quick Look telemetry write failed:', err && err.message ? err.message : err);
  }
}

function ensure_quicklook_debug_flag() {
  try {
    const container_path = path.join(
      os.homedir(),
      'Library',
      'Containers',
      'com.markpane.app.quicklook-host.quicklook',
      'Data',
      'Library',
      'Caches'
    );
    fs.mkdirSync(container_path, { recursive: true });
    const flag_path = path.join(container_path, 'quicklook-extension.debug');
    fs.writeFileSync(flag_path, new Date().toISOString());
  } catch (err) {
    console.warn('Quick Look debug flag write failed:', err && err.message ? err.message : err);
  }
}

function should_offer_quicklook_setup() {
  return is_mac && is_packaged && !is_cli_mode && !is_help;
}

function load_quicklook_state() {
  try {
    const state_path = path.join(app.getPath('userData'), 'quicklook.json');
    if (!fs.existsSync(state_path)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(state_path, 'utf-8'));
  } catch (err) {
    return null;
  }
}

function save_quicklook_state(state) {
  const state_path = path.join(app.getPath('userData'), 'quicklook.json');
  fs.mkdirSync(path.dirname(state_path), { recursive: true });
  fs.writeFileSync(state_path, JSON.stringify(state, null, 2));
}

function remove_quicklook_state() {
  try {
    const state_path = path.join(app.getPath('userData'), 'quicklook.json');
    fs.rmSync(state_path, { force: true });
  } catch (err) {
    console.warn('Quick Look state removal failed:', err && err.message ? err.message : err);
  }
}

function uninstall_quicklook() {
  if (!is_mac || !is_packaged) {
    dialog.showErrorBox('Quick Look Uninstall', 'Quick Look uninstall is only available in the packaged macOS app.');
    return;
  }

  const response = dialog.showMessageBoxSync({
    type: 'warning',
    buttons: ['Uninstall Quick Look', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    message: 'Remove MarkPane Quick Look?',
    detail: 'This will unregister the Quick Look extension, remove MarkPaneQLHost.app from /Applications and ~/Applications, clear Quick Look caches, and delete Quick Look logs.'
  });

  if (response !== 0) {
    return;
  }

  const helper_paths = new Set();
  const state = load_quicklook_state();
  if (state && state.helper_path) {
    helper_paths.add(state.helper_path);
  }
  // New paths
  helper_paths.add(path.join('/Applications', 'MarkPaneQLHost.app'));
  helper_paths.add(path.join(os.homedir(), 'Applications', 'MarkPaneQLHost.app'));
  // Old paths (for existing Peekdown installs)
  helper_paths.add(path.join('/Applications', 'PeekdownQLHost.app'));
  helper_paths.add(path.join(os.homedir(), 'Applications', 'PeekdownQLHost.app'));

  for (const helper_path of helper_paths) {
    // Try both old and new extension names
    const is_old_peekdown = helper_path.includes('Peekdown');
    const extension_name = is_old_peekdown ? 'PeekdownQLExt.appex' : 'MarkPaneQLExt.appex';
    const extension_path = path.join(helper_path, 'Contents', 'PlugIns', extension_name);
    if (fs.existsSync(extension_path)) {
      spawnSync('pluginkit', ['-r', extension_path], { stdio: 'ignore' });
    }
    if (fs.existsSync(helper_path)) {
      fs.rmSync(helper_path, { recursive: true, force: true });
    }
  }

  spawnSync('qlmanage', ['-r'], { stdio: 'ignore' });
  spawnSync('qlmanage', ['-r', 'cache'], { stdio: 'ignore' });

  // Clean up both old and new container caches
  const container_ids = [
    'com.markpane.app.quicklook-host.quicklook',
    'com.peekdown.app.quicklook-host.quicklook'
  ];
  for (const container_id of container_ids) {
    try {
      const container_cache = path.join(
        os.homedir(),
        'Library',
        'Containers',
        container_id,
        'Data',
        'Library',
        'Caches'
      );
      fs.rmSync(path.join(container_cache, 'quicklook-extension.log'), { force: true });
      fs.rmSync(path.join(container_cache, 'quicklook-extension.debug'), { force: true });
    } catch (err) {
      // Silently ignore if container doesn't exist
    }
  }

  remove_quicklook_state();
  dialog.showMessageBoxSync({
    type: 'info',
    buttons: ['OK'],
    message: 'Quick Look removed',
    detail: 'MarkPane Quick Look has been unregistered.'
  });
}

function uninstall_all() {
  if (!is_mac || !is_packaged) {
    dialog.showErrorBox('Uninstall MarkPane', 'Uninstall is only available in the packaged macOS app.');
    return;
  }

  const response = dialog.showMessageBoxSync({
    type: 'warning',
    buttons: ['Uninstall MarkPane', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    message: 'Remove MarkPane?',
    detail: 'This will uninstall MarkPane, unregister the Quick Look extension, remove MarkPaneQLHost.app, clear Quick Look caches, and delete MarkPane.app.'
  });

  if (response !== 0) {
    return;
  }

  uninstall_quicklook();

  const app_path = get_app_bundle_path();
  if (app_path && fs.existsSync(app_path)) {
    fs.rmSync(app_path, { recursive: true, force: true });
  }
}

function copy_app_bundle(source_path, target_path) {
  if (fs.existsSync(target_path)) {
    fs.rmSync(target_path, { recursive: true, force: true });
  }
  fs.cpSync(source_path, target_path, { recursive: true });
}

function quicklook_helper_fingerprint(bundle_path) {
  const host_binary = path.join(bundle_path, 'Contents', 'MacOS', 'MarkPaneQLHost');
  const ext_binary = path.join(bundle_path, 'Contents', 'PlugIns', 'MarkPaneQLExt.appex', 'Contents', 'MacOS', 'MarkPaneQLExt');
  if (!fs.existsSync(host_binary) || !fs.existsSync(ext_binary)) {
    return null;
  }
  const host_hash = crypto.createHash('sha256').update(fs.readFileSync(host_binary)).digest('hex');
  const ext_hash = crypto.createHash('sha256').update(fs.readFileSync(ext_binary)).digest('hex');
  return `${host_hash}:${ext_hash}`;
}

function relaunch_from(target_path) {
  const executable_name = path.basename(app.getPath('exe'));
  const exec_path = path.join(target_path, 'Contents', 'MacOS', executable_name);
  app.relaunch({ execPath: exec_path });
  app.exit(0);
}

async function prompt_move_to_applications() {
  const result = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Move to /Applications', 'Move to ~/Applications', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    message: 'Move MarkPane to Applications?',
    detail: 'MarkPane can register its Quick Look preview only from the Applications folder.'
  });
  return result.response;
}

function register_quicklook(apps_path, telemetry) {
  const helper_source = path.join(process.resourcesPath, 'MarkPaneQLHost.app.bundled');
  if (!fs.existsSync(helper_source)) {
    console.warn('Quick Look helper app not found in resources.');
    if (telemetry) {
      telemetry.outcome = 'missing_helper';
    }
    return;
  }

  const helper_target = path.join(apps_path, 'MarkPaneQLHost.app');
  record_step(telemetry, 'copy_helper', () => copy_app_bundle(helper_source, helper_target));
  const extension_path = path.join(helper_target, 'Contents', 'PlugIns', 'MarkPaneQLExt.appex');
  const extension_binary = path.join(extension_path, 'Contents', 'MacOS', 'MarkPaneQLExt');
  const helper_fingerprint = quicklook_helper_fingerprint(helper_source);

  const signing_ok = record_step(telemetry, 'codesign_verify', () => spawnSync('codesign', ['--verify', '--deep', '--strict', helper_target], {
    stdio: 'ignore'
  }));
  if (signing_ok.status !== 0) {
    console.warn('Quick Look helper is not properly signed. Run `yarn build:quicklook` before packaging.');
    if (telemetry) {
      telemetry.outcome = 'codesign_failed';
    }
    return;
  }

  const entitlements_check = record_step(telemetry, 'entitlements_check', () => spawnSync('codesign', ['-d', '--entitlements', '-', extension_binary], {
    encoding: 'utf-8'
  }));
  if (entitlements_check.status !== 0 || !entitlements_check.stdout.includes('com.apple.security.app-sandbox')) {
    console.warn('Quick Look extension entitlements are missing. Ensure the helper is pre-signed before packaging.');
    if (telemetry) {
      telemetry.outcome = 'entitlements_missing';
    }
    return;
  }

  const state = {
    registered_at: new Date().toISOString(),
    app_path: get_app_bundle_path(),
    helper_path: helper_target,
    helper_fingerprint: helper_fingerprint,
    app_version: app.getVersion()
  };
  save_quicklook_state(state);

  record_event(telemetry, 'xattr_start');
  spawn('xattr', ['-dr', 'com.apple.quarantine', helper_target], {
    detached: true,
    stdio: 'ignore'
  }).unref();

  if (fs.existsSync(extension_path)) {
    record_event(telemetry, 'pluginkit_add', { extension_path });
    spawn('pluginkit', ['-a', extension_path], {
      detached: true,
      stdio: 'ignore'
    }).unref();
  }

  record_event(telemetry, 'open_helper', { helper_target });
  const open_process = spawn('open', ['-a', helper_target, '--args', '--register'], {
    detached: true,
    stdio: 'ignore'
  });
  open_process.unref();
}

async function maybe_handle_quicklook_setup() {
  const telemetry = create_quicklook_telemetry();
  const overall_start = telemetry ? now_ms() : 0;

  if (!should_offer_quicklook_setup()) {
    if (telemetry) {
      telemetry.outcome = 'skipped';
      telemetry.reason = 'not_eligible';
      telemetry.total_ms = Math.round(now_ms() - overall_start);
      write_quicklook_telemetry(telemetry);
    }
    return false;
  }

  const apps_path = get_applications_location();
  if (!apps_path) {
    const response = await record_step(telemetry, 'prompt_move', () => prompt_move_to_applications());
    if (response === 2) {
      app.quit();
      if (telemetry) {
        telemetry.outcome = 'cancelled';
        telemetry.total_ms = Math.round(now_ms() - overall_start);
        write_quicklook_telemetry(telemetry);
      }
      return true;
    }

    const target_root = response === 0 ? '/Applications' : path.join(os.homedir(), 'Applications');
    const bundle_path = get_app_bundle_path();
    if (!bundle_path) {
      app.quit();
      return true;
    }

    try {
      record_step(telemetry, 'mkdir_apps', () => fs.mkdirSync(target_root, { recursive: true }));
      const target_path = path.join(target_root, path.basename(bundle_path));
      record_step(telemetry, 'move_app', () => copy_app_bundle(bundle_path, target_path));
      record_step(telemetry, 'relaunch', () => relaunch_from(target_path));
      if (telemetry) {
        telemetry.outcome = 'relaunch';
        telemetry.total_ms = Math.round(now_ms() - overall_start);
        write_quicklook_telemetry(telemetry);
      }
      return true;
    } catch (err) {
      dialog.showErrorBox('Move Failed', `Could not move MarkPane: ${err.message}`);
      app.quit();
      if (telemetry) {
        telemetry.outcome = 'move_failed';
        telemetry.error = err.message;
        telemetry.total_ms = Math.round(now_ms() - overall_start);
        write_quicklook_telemetry(telemetry);
      }
      return true;
    }
  }

  const state = load_quicklook_state();
  const helper_source = path.join(process.resourcesPath, 'MarkPaneQLHost.app.bundled');
  const helper_target = path.join(apps_path, 'MarkPaneQLHost.app');
  const source_fingerprint = quicklook_helper_fingerprint(helper_source);
  const target_fingerprint = quicklook_helper_fingerprint(helper_target);

  if (state && state.helper_path && state.helper_path !== helper_target && fs.existsSync(state.helper_path)) {
    const stale_extension = path.join(state.helper_path, 'Contents', 'PlugIns', 'MarkPaneQLExt.appex');
    record_step(telemetry, 'pluginkit_remove_stale', () => spawnSync('pluginkit', ['-r', stale_extension], { stdio: 'ignore' }));
    record_step(telemetry, 'remove_stale_helper', () => fs.rmSync(state.helper_path, { recursive: true, force: true }));
  }

  const needs_register = !state
    || state.app_path !== get_app_bundle_path()
    || state.app_version !== app.getVersion()
    || state.helper_fingerprint !== source_fingerprint
    || (source_fingerprint && target_fingerprint !== source_fingerprint);

  if (needs_register) {
    record_step(telemetry, 'register_quicklook', () => register_quicklook(apps_path, telemetry));
  }

  if (telemetry) {
    telemetry.outcome = needs_register ? 'registered' : 'noop';
    telemetry.total_ms = Math.round(now_ms() - overall_start);
    write_quicklook_telemetry(telemetry);
  }

  app.quit();
  return true;
}

function toggle_always_on_top() {
  if (!main_window || main_window.isDestroyed()) {
    return;
  }

  const is_pinned = !main_window.isAlwaysOnTop();
  main_window.setAlwaysOnTop(is_pinned);

  // Update menu checkmark
  const menu = Menu.getApplicationMenu();
  if (menu) {
    const pin_item = menu.getMenuItemById('pin-window');
    if (pin_item) {
      pin_item.checked = is_pinned;
    }
  }

  // Notify renderer
  send_to_renderer('always-on-top-changed', is_pinned);
}

function create_window() {
  const is_pdf_mode = !!pdf_output;

  main_window = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,  // Don't show until ready
    titleBarStyle: is_pdf_mode ? 'default' : 'hiddenInset',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  main_window.loadFile(path.join(__dirname, 'index.html'));
  main_window.setTitle(display_name);

  // Show window immediately when ready (no fade-in)
  if (!is_pdf_mode) {
    main_window.once('ready-to-show', () => {
      main_window.show();
    });
  }

  // Forward renderer console to main process
  main_window.webContents.on('console-message', (event, level, message) => {
    console.log(`[Renderer] ${message}`);
  });

  main_window.webContents.on('did-finish-load', () => {
    if (error_message) {
      if (is_pdf_mode) {
        console.error(error_message);
        app.quit();
      } else {
        send_to_renderer('error', error_message);
        dialog.showErrorBox('Error', error_message);
      }
    } else if (file_content) {
      send_to_renderer('file-content', file_content, display_name, is_pdf_mode);

      if (is_pdf_mode) {
        // Wait for mermaid diagrams to render (ELK renderer is slow)
        setTimeout(async () => {
          try {
            const pdf_data = await main_window.webContents.printToPDF({
              printBackground: true,
              pageSize: 'Letter',
              margins: {
                top: 0.5,
                bottom: 0.5,
                left: 0.5,
                right: 0.5
              }
            });

            const output_path = path.resolve(pdf_output);
            fs.writeFileSync(output_path, pdf_data);
            console.log(`PDF saved to: ${output_path}`);
            app.quit();
          } catch (err) {
            console.error(`Failed to generate PDF: ${err.message}`);
            app.quit();
          }
        }, 5000);  // 5 second delay for ELK mermaid rendering
      }
    }
  });

  // Only register shortcuts in UI mode
  if (!is_pdf_mode) {
    globalShortcut.register('Escape', () => {
      if (main_window && !main_window.isDestroyed()) {
        main_window.close();
      }
    });

    globalShortcut.register('CommandOrControl+W', () => {
      if (main_window && !main_window.isDestroyed()) {
        main_window.close();
      }
    });
  }

  main_window.on('closed', () => {
    stop_file_watcher();
    main_window = null;
  });

  // Start file watcher (UI mode only)
  if (!is_pdf_mode) {
    start_file_watcher();
  }
}

app.whenReady().then(async () => {
  if (uninstall_quicklook_flag) {
    uninstall_quicklook();
    app.quit();
    return;
  }

  if (uninstall_all_flag) {
    uninstall_all();
    app.quit();
    return;
  }

  // Handle file open requests from renderer
  ipcMain.on('open-file', (event, new_file_path) => {
    // Validate path type
    if (typeof new_file_path !== 'string') {
      send_to_renderer('error', 'Invalid file path');
      return;
    }

    // Normalize and resolve path (prevents traversal)
    const resolved_path = path.resolve(new_file_path);

    // Check extension (UX guard)
    const allowed_extensions = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdwn', '.mdx', '.txt'];
    const ext = path.extname(resolved_path).toLowerCase();
    if (!allowed_extensions.includes(ext)) {
      send_to_renderer('error', 'Unsupported file type');
      return;
    }

    // Check existence
    if (!fs.existsSync(resolved_path)) {
      send_to_renderer('error', 'File not found');
      return;
    }

    // Read and send file
    try {
      stop_file_watcher();

      // Read into local variables first, only mutate globals on success
      const content = fs.readFileSync(resolved_path, 'utf-8');

      // Success - update globals
      file_path = resolved_path;
      file_content = content;
      display_name = path.basename(file_path);

      send_to_renderer('file-content', file_content, display_name, false);
      if (main_window && !main_window.isDestroyed()) {
        main_window.setTitle(display_name);
      }
      start_file_watcher();
    } catch (err) {
      console.error('Failed to open file:', resolved_path, err.message);
      send_to_renderer('error', `Failed to read file: ${err.message}`);
    }
  });

  // Handle always-on-top toggle
  ipcMain.on('toggle-always-on-top', toggle_always_on_top);

  const handled_quicklook = await maybe_handle_quicklook_setup();
  if (handled_quicklook) {
    return;
  }

  // Build menu for all platforms
  const is_pdf_mode = !!pdf_output;
  if (!is_cli_mode && !is_pdf_mode) {
    const template = [];

    // macOS-specific menu items
    if (is_mac) {
      template.push({
        label: app.name,
        submenu: [
          {
            label: 'Uninstall Quick Look…',
            click: uninstall_quicklook
          },
          {
            label: 'Uninstall MarkPane…',
            click: uninstall_all
          },
          { type: 'separator' },
          { role: 'quit' }
        ]
      });
    }

    // View menu (all platforms)
    template.push({
      label: 'View',
      submenu: [
        {
          label: 'Toggle Table of Contents',
          accelerator: 'CommandOrControl+Shift+O',
          click: () => send_to_renderer('toggle-toc')
        }
      ]
    });

    // Window menu (all platforms)
    template.push({
      label: 'Window',
      submenu: [
        {
          label: 'Pin Window',
          type: 'checkbox',
          id: 'pin-window',
          accelerator: 'CmdOrCtrl+Shift+A',
          checked: false,
          click: toggle_always_on_top
        }
      ]
    });


    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  create_window();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      create_window();
    }
  });
});

app.on('window-all-closed', () => {
  stop_file_watcher();
  globalShortcut.unregisterAll();
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
