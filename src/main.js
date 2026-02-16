const { app, BrowserWindow, dialog, Menu, ipcMain, shell } = require('electron');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

let quicklook_debug = false;

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

function load_window_bounds() {
  try {
    const bounds_path = path.join(app.getPath('userData'), 'window-bounds.json');
    if (!fs.existsSync(bounds_path)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(bounds_path, 'utf-8'));
  } catch (err) {
    return null;
  }
}

function save_window_bounds(bounds) {
  try {
    const bounds_path = path.join(app.getPath('userData'), 'window-bounds.json');
    fs.mkdirSync(path.dirname(bounds_path), { recursive: true });
    fs.writeFileSync(bounds_path, JSON.stringify(bounds, null, 2));
  } catch (err) {
    console.error('Failed to save window bounds:', err);
  }
}

function load_settings() {
  try {
    const settings_path = path.join(app.getPath('userData'), 'settings.json');
    if (!fs.existsSync(settings_path)) {
      return { theme: 'system', bodyFont: 'San Francisco', codeFont: 'SF Mono' };
    }
    const settings = JSON.parse(fs.readFileSync(settings_path, 'utf-8'));
    // Migrate old 'font' setting to bodyFont
    if (settings.font && !settings.bodyFont) {
      settings.bodyFont = settings.font === 'System Default' ? 'San Francisco' : settings.font;
      delete settings.font;
    }
    // Set defaults if missing
    if (!settings.bodyFont) settings.bodyFont = 'San Francisco';
    if (!settings.codeFont) settings.codeFont = 'SF Mono';
    return settings;
  } catch (err) {
    return { theme: 'system', bodyFont: 'San Francisco', codeFont: 'SF Mono' };
  }
}

function save_settings(settings) {
  try {
    const settings_path = path.join(app.getPath('userData'), 'settings.json');
    fs.mkdirSync(path.dirname(settings_path), { recursive: true });
    fs.writeFileSync(settings_path, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

let cached_system_fonts = null;

function enumerate_system_fonts() {
  if (cached_system_fonts) {
    return cached_system_fonts;
  }

  try {
    // Write JXA script to temp file to avoid escaping issues
    const temp_script = path.join(os.tmpdir(), 'markpane-fonts.js');
    const jxa_script = `ObjC.import('Cocoa');
const font_manager = $.NSFontManager.sharedFontManager;
const families_array = font_manager.availableFontFamilies;
const families_count = families_array.count;

const body_fonts = [];
const mono_fonts = [];

const excluded_patterns = [/^\\./, /emoji/i, /symbol/i, /braille/i, /wingdings/i, /zapf dingbats/i];

for (let i = 0; i < families_count; i++) {
  const family = ObjC.unwrap(families_array.objectAtIndex(i));

  if (excluded_patterns.some(pattern => pattern.test(family))) {
    continue;
  }

  const font = $.NSFont.fontWithNameSize(family, 12.0);
  if (!font || font.js === null || font.js === undefined) {
    continue;
  }

  const traits = font_manager.traitsOfFont(font);
  const is_monospace = (traits & (1 << 10)) !== 0;

  if (is_monospace) {
    mono_fonts.push(family);
  } else {
    body_fonts.push(family);
  }
}

if (!body_fonts.includes('San Francisco')) {
  body_fonts.push('San Francisco');
}
if (!mono_fonts.includes('SF Mono')) {
  mono_fonts.push('SF Mono');
}

body_fonts.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
mono_fonts.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

JSON.stringify({ body: body_fonts, mono: mono_fonts });`;

    fs.writeFileSync(temp_script, jxa_script);

    const result = spawnSync('osascript', ['-l', 'JavaScript', temp_script], {
      timeout: 5000,
      encoding: 'utf-8'
    });

    // Clean up temp file
    try {
      fs.unlinkSync(temp_script);
    } catch (e) {
      // Ignore cleanup errors
    }

    if (result.error || result.status !== 0) {
      console.error('[Font Enumeration] Failed:', result.stderr);
      return null;
    }

    const fonts = JSON.parse(result.stdout.trim());
    cached_system_fonts = fonts;
    return fonts;
  } catch (err) {
    console.error('[Font Enumeration] Exception:', err);
    return null;
  }
}

function normalize_file_path(fp) {
  try {
    return fs.realpathSync(path.resolve(fp));
  } catch (err) {
    return path.resolve(fp);
  }
}

function load_recent_files() {
  try {
    const recent_path = path.join(app.getPath('userData'), 'recent-files.json');
    if (!fs.existsSync(recent_path)) {
      return [];
    }
    const files = JSON.parse(fs.readFileSync(recent_path, 'utf-8'));
    if (!Array.isArray(files)) return [];

    // Migrate old format (array of objects) to new format (array of strings)
    return files.map(item => {
      if (typeof item === 'string') {
        return item;
      }
      // Old format: {path, display_name, last_opened}
      return item && item.path ? item.path : null;
    }).filter(Boolean);
  } catch (err) {
    return [];
  }
}

function save_recent_files(files) {
  try {
    const recent_path = path.join(app.getPath('userData'), 'recent-files.json');
    fs.mkdirSync(path.dirname(recent_path), { recursive: true });
    fs.writeFileSync(recent_path, JSON.stringify(files, null, 2));
  } catch (err) {
    console.error('Failed to save recent files:', err);
  }
}

function add_recent_file(fp) {
  const normalized = normalize_file_path(fp);
  let recent = load_recent_files();

  // Remove duplicates
  recent = recent.filter(item => item !== normalized);

  // Add to front
  recent.unshift(normalized);

  // Cap at 10
  if (recent.length > 10) {
    recent = recent.slice(0, 10);
  }

  save_recent_files(recent);
  rebuild_app_menu();
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

function open_file(fp) {
  const normalized_path = normalize_file_path(fp);

  // Check if file is already open
  const existing_window = BrowserWindow.getAllWindows().find(
    win => win.markpane_file_path === normalized_path
  );

  if (existing_window) {
    if (existing_window.isDestroyed()) return;
    existing_window.focus();
    return;
  }

  create_window(normalized_path);
  add_recent_file(normalized_path);
}

function create_window(target_file_path) {
  const is_pdf_mode = !!pdf_output;

  // Read file for this window
  let file_content = null;
  let error_message = null;
  let display_name = 'MarkPane';

  if (target_file_path) {
    const normalized_path = normalize_file_path(target_file_path);
    if (!fs.existsSync(normalized_path)) {
      error_message = `File not found: ${normalized_path}`;
    } else {
      try {
        file_content = fs.readFileSync(normalized_path, 'utf-8');
        display_name = path.basename(normalized_path);
      } catch (err) {
        error_message = `Failed to read file: ${err.message}`;
      }
    }
  }

  // Load saved bounds or use defaults
  const saved_bounds = load_window_bounds();
  const default_bounds = { width: 900, height: 700 };

  // Cascade position for additional windows
  const existing_windows = BrowserWindow.getAllWindows().length;
  const cascade_offset = existing_windows * 22;

  const bounds = saved_bounds
    ? {
        x: saved_bounds.x + cascade_offset,
        y: saved_bounds.y + cascade_offset,
        width: saved_bounds.width,
        height: saved_bounds.height
      }
    : {
        width: default_bounds.width,
        height: default_bounds.height
      };

  const win = new BrowserWindow({
    ...bounds,
    show: false,
    titleBarStyle: is_pdf_mode ? 'default' : 'hiddenInset',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Store file path on window
  if (target_file_path) {
    win.markpane_file_path = normalize_file_path(target_file_path);
  }

  win.loadFile(path.join(__dirname, 'index.html'));
  win.setTitle(display_name);

  // Show window immediately when ready
  if (!is_pdf_mode) {
    win.once('ready-to-show', () => {
      win.show();
    });
  }

  // Open external links in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url);
      }
    } catch (e) {
      // Ignore malformed URLs
    }
    return { action: 'deny' };
  });

  // Prevent navigation to external URLs
  win.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    try {
      const parsed_url = new URL(url);
      if (parsed_url.protocol === 'http:' || parsed_url.protocol === 'https:') {
        shell.openExternal(url);
      }
    } catch (e) {
      // Malformed URL, do nothing
    }
  });

  // Forward renderer console to main process
  win.webContents.on('console-message', (event, level, message) => {
    console.log(`[Renderer] ${message}`);
  });

  win.webContents.on('did-finish-load', () => {
    if (error_message) {
      if (is_pdf_mode) {
        console.error(error_message);
        app.quit();
      } else {
        win.webContents.send('error', error_message);
        dialog.showErrorBox('Error', error_message);
      }
    } else if (file_content) {
      const settings = load_settings();
      const system_fonts = enumerate_system_fonts();
      if (system_fonts) {
        win.webContents.send('system-fonts', system_fonts);
      }
      win.webContents.send('file-content', file_content, display_name, is_pdf_mode);
      win.webContents.send('settings', settings);

      if (is_pdf_mode) {
        setTimeout(async () => {
          try {
            const pdf_data = await win.webContents.printToPDF({
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
        }, 5000);
      }
    }
  });

  // Debounced bounds persistence
  if (!is_pdf_mode) {
    let save_timeout;
    const debounced_save = () => {
      clearTimeout(save_timeout);
      save_timeout = setTimeout(() => {
        const bounds = win.getBounds();
        save_window_bounds(bounds);
      }, 500);
    };

    win.on('move', debounced_save);
    win.on('resize', debounced_save);
  }
}

function rebuild_app_menu() {
  if (!is_mac || !!pdf_output) {
    return;
  }

  const recent_files = load_recent_files();
  const recent_submenu = recent_files.length > 0
    ? recent_files.map(fp => ({
        label: path.basename(fp),
        click: () => open_file(fp)
      }))
    : [{ label: 'No Recent Files', enabled: false }];

  const template = [
    {
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
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open File…',
          accelerator: 'CommandOrControl+O',
          click: async () => {
            const result = await dialog.showOpenDialog({
              properties: ['openFile'],
              filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
            });
            if (!result.canceled && result.filePaths.length > 0) {
              open_file(result.filePaths[0]);
            }
          }
        },
        {
          label: 'Open Recent',
          submenu: recent_submenu
        },
        { type: 'separator' },
        {
          role: 'close',
          label: 'Close',
          accelerator: 'CommandOrControl+W'
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Table of Contents',
          accelerator: 'CommandOrControl+Shift+O',
          click: () => {
            const focused = BrowserWindow.getFocusedWindow();
            if (focused && !focused.isDestroyed()) {
              focused.webContents.send('toggle-toc');
            }
          }
        },
        {
          label: 'Find in Page',
          accelerator: 'CommandOrControl+F',
          click: () => {
            const focused = BrowserWindow.getFocusedWindow();
            if (focused && !focused.isDestroyed()) {
              focused.webContents.send('show-find');
            }
          }
        },
        {
          label: 'Settings',
          accelerator: 'CommandOrControl+,',
          click: () => {
            const focused = BrowserWindow.getFocusedWindow();
            if (focused && !focused.isDestroyed()) {
              focused.webContents.send('toggle-settings');
            }
          }
        }
      ]
    },
    {
      role: 'windowMenu'
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Find-in-page IPC handlers
ipcMain.on('find-text', (event, query) => {
  event.sender.findInPage(query, { findNext: true });
});

ipcMain.on('stop-find', (event, action) => {
  const valid_actions = ['clearSelection', 'keepSelection', 'activateSelection'];
  const validated_action = valid_actions.includes(action) ? action : 'clearSelection';
  event.sender.stopFindInPage(validated_action);
});

// Settings IPC handlers
ipcMain.on('save-settings', (event, settings) => {
  save_settings(settings);
  // Broadcast to all windows
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) {
      win.webContents.send('settings-changed', settings);
    }
  });
});

// Window close handler
ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.close();
});

// Quit app handler
ipcMain.on('quit-app', () => {
  app.quit();
});

// Forward found-in-page events to renderer
app.on('web-contents-created', (event, contents) => {
  contents.on('found-in-page', (event, result) => {
    contents.send('found-in-page', result);
  });
});

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

  const handled_quicklook = await maybe_handle_quicklook_setup();
  if (handled_quicklook) {
    return;
  }

  rebuild_app_menu();

  if (file_path) {
    create_window(file_path);
    if (!pdf_output) {
      add_recent_file(file_path);
    }
  } else if (!is_cli_mode) {
    create_window(null);
  }
});

// Flush window bounds before quit (debounce might drop last position)
app.on('before-quit', () => {
  const focused_window = BrowserWindow.getFocusedWindow();
  if (focused_window && !focused_window.isDestroyed()) {
    save_window_bounds(focused_window.getBounds());
  } else {
    // Fallback to first window if no focused window
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0 && !windows[0].isDestroyed()) {
      save_window_bounds(windows[0].getBounds());
    }
  }
});

// macOS: stay alive when all windows closed
app.on('window-all-closed', () => {
  if (!is_mac) {
    app.quit();
  }
});

// macOS: re-open window when dock icon clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const recent_files = load_recent_files();
    if (recent_files.length > 0) {
      open_file(recent_files[0]);
    } else {
      // Fallback: show open dialog
      dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
      }).then(result => {
        if (!result.canceled && result.filePaths.length > 0) {
          open_file(result.filePaths[0]);
        }
      });
    }
  }
});

// macOS: handle files opened from Finder/dock
app.on('open-file', (event, file_path) => {
  event.preventDefault();
  if (app.isReady()) {
    open_file(file_path);
  } else {
    app.whenReady().then(() => open_file(file_path));
  }
});
