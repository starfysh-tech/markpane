const { app, BrowserWindow, dialog, globalShortcut, Menu, ipcMain } = require('electron');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

let display_name = 'Peekdown';
let main_window = null;
let file_content = null;
let error_message = null;
let quicklook_debug = false;
let preferences = null;
let save_preferences_timeout = null;
let file_watcher = null;
let file_watch_debounce_timeout = null;

// Parse CLI args
const args = process.argv.slice(app.isPackaged ? 1 : 2);
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
  peekdown <file.md>                View markdown file
  peekdown <file.md> --pdf out.pdf  Export to PDF

Options:
  -h, --help      Show this help message
  -v, --version   Show version number
  --ql-debug      Enable Quick Look telemetry logging
  --uninstall-quicklook  Remove the Quick Look extension
  --uninstall-all  Remove Peekdown and its Quick Look extension

Shortcuts:
  Escape          Close window
  Cmd/Ctrl+W      Close window
`);
  process.exit(0);
}

const is_mac = process.platform === 'darwin';
const is_packaged = app.isPackaged;
const is_help = args.includes('--help') || args.includes('-h');
// AI context file patterns
const ai_file_patterns = [
  /^CLAUDE\.md$/i,
  /^\.claude\/.*\.md$/i,
  /^llms\.txt$/i,
  /^llms-full\.txt$/i,
  /^\.cursorrules$/i,
  /^PROMPT\.md$/i,
  /^AGENTS\.md$/i,
  /^COPILOT\.md$/i,
  /^\.github\/copilot-instructions\.md$/i,
  /^rules\.md$/i,
  /^\.windsurfrules$/i
];

function is_ai_context_file(file_path) {
  if (!file_path) {
    return false;
  }

  const basename = path.basename(file_path);
  const relative_path = file_path.replace(/\\/g, '/');

  return ai_file_patterns.some(pattern => {
    if (pattern.test(basename)) {
      return true;
    }
    if (pattern.test(relative_path)) {
      return true;
    }
    // Check last part of path for .claude/**/*.md pattern
    const parts = relative_path.split('/');
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i] === '.claude' && /\.md$/i.test(parts[parts.length - 1])) {
        return true;
      }
    }
    return false;
  });
}

function setup_file_watcher(watched_file_path) {
  // Clean up existing watcher
  if (file_watcher) {
    file_watcher.close();
    file_watcher = null;
  }

  if (file_watch_debounce_timeout) {
    clearTimeout(file_watch_debounce_timeout);
    file_watch_debounce_timeout = null;
  }

  if (!watched_file_path || !fs.existsSync(watched_file_path)) {
    return;
  }

  try {
    file_watcher = fs.watch(watched_file_path, (event_type) => {
      // Debounce rapid file events (macOS fires duplicate events)
      if (file_watch_debounce_timeout) {
        clearTimeout(file_watch_debounce_timeout);
      }

      file_watch_debounce_timeout = setTimeout(() => {
        // Handle rename event (file deletion/move)
        if (event_type === 'rename') {
          if (!fs.existsSync(watched_file_path)) {
            console.log('Watched file deleted or moved:', watched_file_path);
            if (file_watcher) {
              file_watcher.close();
              file_watcher = null;
            }
            return;
          }
        }

        // Reload file content
        if (main_window && !main_window.isDestroyed()) {
          try {
            const new_content = fs.readFileSync(watched_file_path, 'utf-8');
            main_window.webContents.send('file-changed', new_content);
          } catch (err) {
            console.error('Failed to reload file:', err.message);
          }
        }
      }, 200); // 200ms debounce
    });
  } catch (err) {
    console.error('Failed to setup file watcher:', err.message);
  }
}


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

// Register open-file handler BEFORE app.whenReady (macOS sends this during launch)
app.on('open-file', (event, path_arg) => {
  event.preventDefault();
  if (main_window && !main_window.isDestroyed()) {
    load_file(path_arg);
  } else {
    file_path = path_arg;
  }
});


// Read input file
if (!file_path) {
  if (is_cli_mode) {
    error_message = 'No markdown file specified.\nUsage: peekdown <file.md> [--pdf output.pdf]\nRun peekdown --help for more options.';
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
  const env_value = process.env.PEEKDOWN_QL_DEBUG;
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
      'com.peekdown.app.quicklook-host.quicklook',
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

function load_preferences() {
  try {
    const prefs_path = path.join(app.getPath('userData'), 'preferences.json');
    if (!fs.existsSync(prefs_path)) {
      return {
        window: { x: null, y: null, width: 900, height: 700, is_maximized: false },
        last_file: null,
        always_on_top: false,
        toc_visible: false,
        recent_files: []
      };
    }
    return JSON.parse(fs.readFileSync(prefs_path, 'utf-8'));
  } catch (err) {
    console.warn('Failed to load preferences:', err && err.message ? err.message : err);
    return {
      window: { x: null, y: null, width: 900, height: 700, is_maximized: false },
      last_file: null,
      always_on_top: false,
      toc_visible: false,
      recent_files: []
    };
  }
}

function save_preferences() {
  if (!preferences) {
    return;
  }
  try {
    const prefs_path = path.join(app.getPath('userData'), 'preferences.json');
    fs.mkdirSync(path.dirname(prefs_path), { recursive: true });
    fs.writeFileSync(prefs_path, JSON.stringify(preferences, null, 2));
  } catch (err) {
    console.warn('Failed to save preferences:', err && err.message ? err.message : err);
  }
}

function save_preferences_debounced() {
  if (save_preferences_timeout) {
    clearTimeout(save_preferences_timeout);
  }
  save_preferences_timeout = setTimeout(() => {
    save_preferences();
    save_preferences_timeout = null;
  }, 500);
}

function add_to_recent_files(file_path_arg) {
  if (!preferences || !file_path_arg) {
    return;
  }

  const abs_path = path.resolve(file_path_arg);

  // Remove duplicates (case-insensitive on macOS)
  preferences.recent_files = preferences.recent_files.filter(f =>
    path.resolve(f).toLowerCase() !== abs_path.toLowerCase()
  );

  // Add to front
  preferences.recent_files.unshift(abs_path);

  // Keep max 10 recent files
  if (preferences.recent_files.length > 10) {
    preferences.recent_files = preferences.recent_files.slice(0, 10);
  }

  save_preferences_debounced();
  rebuild_menu();
}

function load_file(new_path) {
  if (!fs.existsSync(new_path)) {
    dialog.showErrorBox('File Not Found', `File not found: ${new_path}`);
    return;
  }

  try {
    file_content = fs.readFileSync(new_path, 'utf-8');
    file_path = new_path;
    display_name = path.basename(new_path);

    if (main_window && !main_window.isDestroyed()) {
      main_window.setTitle(display_name);
      main_window.webContents.send('file-content', file_content, display_name, false);
      add_to_recent_files(new_path);

      // Update last_file in preferences
      if (preferences) {
        preferences.last_file = new_path;
        save_preferences_debounced();
      }
    }
  } catch (err) {
    dialog.showErrorBox('Read Error', `Failed to read file: ${err.message}`);
  }
}

function rebuild_menu() {
  if (!is_mac || is_cli_mode || !preferences) {
    return;
  }

  const recent_files_submenu = preferences.recent_files
    .filter(f => fs.existsSync(f))
    .map(f => ({
      label: path.basename(f),
      sublabel: path.dirname(f),
      click: () => load_file(f)
    }));

  // Add clear menu if there are recent files
  if (recent_files_submenu.length > 0) {
    recent_files_submenu.push(
      { type: 'separator' },
      {
        label: 'Clear Recent Files',
        click: () => {
          if (preferences) {
            preferences.recent_files = [];
            save_preferences_debounced();
            rebuild_menu();
          }
        }
      }
    );
  } else {
    recent_files_submenu.push({
      label: 'No Recent Files',
      enabled: false
    });
  }

  const template = [
    {
      label: app.name,
      submenu: [
        {
          label: 'Uninstall Quick Look…',
          click: uninstall_quicklook
        },
        {
          label: 'Uninstall Peekdown…',
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
          label: 'Recent Files',
          submenu: recent_files_submenu
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'copy' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Pin on Top',
          type: 'checkbox',
          checked: preferences.always_on_top,
          accelerator: 'CommandOrControl+Shift+P',
          click: toggle_pin
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function track_window_state() {
  if (!main_window || main_window.isDestroyed() || !preferences) {
    return;
  }

  const update_window_bounds = () => {
    if (!main_window || main_window.isDestroyed() || main_window.isMinimized()) {
      return;
    }
    const bounds = main_window.getBounds();
    preferences.window.x = bounds.x;
    preferences.window.y = bounds.y;
    preferences.window.width = bounds.width;
    preferences.window.height = bounds.height;
    preferences.window.is_maximized = main_window.isMaximized();
    save_preferences_debounced();
  };

  main_window.on('resize', update_window_bounds);
  main_window.on('move', update_window_bounds);
  main_window.on('maximize', () => {
    if (preferences) {
      preferences.window.is_maximized = true;
      save_preferences_debounced();
    }
  });
  main_window.on('unmaximize', () => {
    if (preferences) {
      preferences.window.is_maximized = false;
      save_preferences_debounced();
    }
  });
}

function toggle_pin() {
  if (!main_window || main_window.isDestroyed()) {
    return;
  }
  if (!preferences) {
    return;
  }
  preferences.always_on_top = !preferences.always_on_top;
  main_window.setAlwaysOnTop(preferences.always_on_top);
  main_window.webContents.send('pin-state-changed', preferences.always_on_top);
  save_preferences_debounced();

  // Update menu
  rebuild_menu();
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
    message: 'Remove Peekdown Quick Look?',
    detail: 'This will unregister the Quick Look extension, remove PeekdownQLHost.app from /Applications and ~/Applications, clear Quick Look caches, and delete Quick Look logs.'
  });

  if (response !== 0) {
    return;
  }

  const helper_paths = new Set();
  const state = load_quicklook_state();
  if (state && state.helper_path) {
    helper_paths.add(state.helper_path);
  }
  helper_paths.add(path.join('/Applications', 'PeekdownQLHost.app'));
  helper_paths.add(path.join(os.homedir(), 'Applications', 'PeekdownQLHost.app'));

  for (const helper_path of helper_paths) {
    const extension_path = path.join(helper_path, 'Contents', 'PlugIns', 'PeekdownQLExt.appex');
    if (fs.existsSync(extension_path)) {
      spawnSync('pluginkit', ['-r', extension_path], { stdio: 'ignore' });
    }
    if (fs.existsSync(helper_path)) {
      fs.rmSync(helper_path, { recursive: true, force: true });
    }
  }

  spawnSync('qlmanage', ['-r'], { stdio: 'ignore' });
  spawnSync('qlmanage', ['-r', 'cache'], { stdio: 'ignore' });

  try {
    const container_cache = path.join(
      os.homedir(),
      'Library',
      'Containers',
      'com.peekdown.app.quicklook-host.quicklook',
      'Data',
      'Library',
      'Caches'
    );
    fs.rmSync(path.join(container_cache, 'quicklook-extension.log'), { force: true });
    fs.rmSync(path.join(container_cache, 'quicklook-extension.debug'), { force: true });
  } catch (err) {
    console.warn('Quick Look log cleanup failed:', err && err.message ? err.message : err);
  }

  remove_quicklook_state();
  dialog.showMessageBoxSync({
    type: 'info',
    buttons: ['OK'],
    message: 'Quick Look removed',
    detail: 'Peekdown Quick Look has been unregistered.'
  });
}

function uninstall_all() {
  if (!is_mac || !is_packaged) {
    dialog.showErrorBox('Uninstall Peekdown', 'Uninstall is only available in the packaged macOS app.');
    return;
  }

  const response = dialog.showMessageBoxSync({
    type: 'warning',
    buttons: ['Uninstall Peekdown', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    message: 'Remove Peekdown?',
    detail: 'This will uninstall Peekdown, unregister the Quick Look extension, remove PeekdownQLHost.app, clear Quick Look caches, and delete Peekdown.app.'
  });

  if (response !== 0) {
    return;
  }

  uninstall_quicklook();

  const app_path = get_app_bundle_path();
  if (app_path && fs.existsSync(app_path)) {
    // Use shell rm to bypass Electron's ASAR interception
    const result = spawnSync('rm', ['-rf', app_path], { stdio: 'ignore' });
    if (result.status !== 0) {
      throw new Error(`Failed to remove app at ${app_path}`);
    }
  }
}

function copy_app_bundle(source_path, target_path) {
  if (fs.existsSync(target_path)) {
    // Use shell rm to bypass Electron's ASAR interception
    const result = spawnSync('rm', ['-rf', target_path], { stdio: 'ignore' });
    if (result.status !== 0) {
      throw new Error(`Failed to remove existing app at ${target_path}`);
    }
  }
  fs.cpSync(source_path, target_path, { recursive: true });
}

function quicklook_helper_fingerprint(bundle_path) {
  const host_binary = path.join(bundle_path, 'Contents', 'MacOS', 'PeekdownQLHost');
  const ext_binary = path.join(bundle_path, 'Contents', 'PlugIns', 'PeekdownQLExt.appex', 'Contents', 'MacOS', 'PeekdownQLExt');
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
    message: 'Move Peekdown to Applications?',
    detail: 'Peekdown can register its Quick Look preview only from the Applications folder.'
  });
  return result.response;
}

function register_quicklook(apps_path, telemetry) {
  const helper_source = path.join(process.resourcesPath, 'PeekdownQLHost.app.bundled');
  if (!fs.existsSync(helper_source)) {
    console.warn('Quick Look helper app not found in resources.');
    if (telemetry) {
      telemetry.outcome = 'missing_helper';
    }
    return;
  }

  const helper_target = path.join(apps_path, 'PeekdownQLHost.app');
  record_step(telemetry, 'copy_helper', () => copy_app_bundle(helper_source, helper_target));
  const extension_path = path.join(helper_target, 'Contents', 'PlugIns', 'PeekdownQLExt.appex');
  const extension_binary = path.join(extension_path, 'Contents', 'MacOS', 'PeekdownQLExt');
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
      dialog.showErrorBox('Move Failed', `Could not move Peekdown: ${err.message}`);
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
  const helper_source = path.join(process.resourcesPath, 'PeekdownQLHost.app.bundled');
  const helper_target = path.join(apps_path, 'PeekdownQLHost.app');
  const source_fingerprint = quicklook_helper_fingerprint(helper_source);
  const target_fingerprint = quicklook_helper_fingerprint(helper_target);

  if (state && state.helper_path && state.helper_path !== helper_target && fs.existsSync(state.helper_path)) {
    const stale_extension = path.join(state.helper_path, 'Contents', 'PlugIns', 'PeekdownQLExt.appex');
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

function create_window() {
  const is_pdf_mode = !!pdf_output;

  // Load preferences only in non-PDF mode
  if (!is_pdf_mode) {
    preferences = load_preferences();
  }

  const window_config = {
    width: preferences ? preferences.window.width : 900,
    height: preferences ? preferences.window.height : 700,
    show: !is_pdf_mode,  // Hide window in PDF mode
    titleBarStyle: is_pdf_mode ? 'default' : 'hiddenInset',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  };

  // Restore window position if available
  if (preferences && preferences.window.x !== null && preferences.window.y !== null) {
    window_config.x = preferences.window.x;
    window_config.y = preferences.window.y;
  }

  main_window = new BrowserWindow(window_config);

  // Restore maximized state
  if (preferences && preferences.window.is_maximized) {
    main_window.maximize();
  }

  // Restore always-on-top state
  if (preferences && preferences.always_on_top) {
    main_window.setAlwaysOnTop(true);
  }

  // Track window state changes only in non-PDF mode
  if (!is_pdf_mode) {
    track_window_state();
  }

  main_window.loadFile(path.join(__dirname, 'index.html'));
  main_window.setTitle(display_name);

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
        main_window.webContents.send('error', error_message);
        dialog.showErrorBox('Error', error_message);
      }
    } else if (file_content) {
      const is_ai_file = is_ai_context_file(file_path);
      main_window.webContents.send('file-content', file_content, display_name, is_pdf_mode, is_ai_file);

      // Setup file watcher for AI context files (not in PDF mode)
      if (is_ai_file && !is_pdf_mode) {
        setup_file_watcher(file_path);
      }

      // Add to recent files if not in PDF mode
      if (!is_pdf_mode && file_path) {
        add_to_recent_files(file_path);
      }

      // Send initial pin state to renderer
      if (!is_pdf_mode && preferences) {
        main_window.webContents.send('pin-state-changed', preferences.always_on_top);
      }

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
    // Clean up file watcher
    if (file_watcher) {
      file_watcher.close();
      file_watcher = null;
    }
    if (file_watch_debounce_timeout) {
      clearTimeout(file_watch_debounce_timeout);
      file_watch_debounce_timeout = null;
    }
    main_window = null;
  });
}

// Register IPC handlers (must be before app.whenReady for renderer access)
ipcMain.on('toggle-pin', () => {
  toggle_pin();
});

ipcMain.on('set-toc-visible', (_event, is_visible) => {
  if (preferences) {
    preferences.toc_visible = is_visible;
    save_preferences_debounced();
  }
});

ipcMain.handle('get-toc-visible', () => {
  return preferences ? preferences.toc_visible : false;
});

ipcMain.on('context-menu', (event, data) => {
  const { selection_text, has_selection } = data;
  if (!has_selection || !selection_text) {
    return;
  }

  const context_menu = Menu.buildFromTemplate([
    {
      label: 'Copy',
      role: 'copy'
    },
    {
      label: 'Copy as HTML',
      click: () => {
        if (main_window && !main_window.isDestroyed()) {
          main_window.webContents.send('copy-as-html');
        }
      }
    }
  ]);

  context_menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
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

  if (is_mac && !is_cli_mode) {
    const template = [
      {
        label: app.name,
        submenu: [
          {
            label: 'Uninstall Quick Look…',
            click: uninstall_quicklook
          },
          {
            label: 'Uninstall Peekdown…',
            click: uninstall_all
          },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'copy' },
          { role: 'selectAll' }
        ]
      }
    ];
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
  globalShortcut.unregisterAll();
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
