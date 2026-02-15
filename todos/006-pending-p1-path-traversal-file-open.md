# Path Traversal Vulnerability in File Open Handler

## Metadata
```yaml
status: pending
priority: p1
issue_id: 006
tags: [code-review, security, electron, ipc]
dependencies: []
```

## Problem Statement

The `open-file` IPC handler accepts arbitrary file paths from the renderer without normalization or directory restriction. This allows reading any file on the system with an allowed extension, enabling path traversal attacks.

**Why it matters:** Path traversal is a HIGH severity vulnerability (OWASP A01: Broken Access Control). If the renderer is compromised, an attacker can read sensitive files like SSH keys, configuration files, or any markdown/text file on the system.

## Findings

**Source:** security-sentinel agent review
**Location:** `/Users/randallnoval/Code/markpane/src/main.js:667-711`

**Vulnerability:**
```javascript
ipcMain.on('open-file', (event, new_file_path) => {
  if (typeof new_file_path !== 'string') { /* validation */ }
  if (!fs.existsSync(new_file_path)) { /* error */ }

  // Extension check happens AFTER existence check
  const ext = path.extname(new_file_path).toLowerCase();
  if (!allowed_extensions.includes(ext)) { /* reject */ }

  file_content = fs.readFileSync(file_path, 'utf-8');
```

**Attack vectors:**
1. Read system files: `/etc/hosts` (existence revealed before extension check fails)
2. Traverse directories: `../../../../.ssh/config.md`
3. Access sensitive markdown files anywhere on system

**Evidence:** No path normalization or directory restrictions in handler.

## Proposed Solutions

### Option 1: Path Normalization + Directory Allowlist (Recommended)
**Pros:**
- Prevents path traversal completely
- Restricts access to user directories only
- Industry-standard approach

**Cons:**
- Slightly more restrictive UX (can't open files from /tmp)

**Effort:** Small (10 minutes)
**Risk:** Low

**Implementation:**
```javascript
ipcMain.on('open-file', (event, new_file_path) => {
  if (typeof new_file_path !== 'string') {
    main_window.webContents.send('error', 'Invalid file path');
    return;
  }

  // Normalize and resolve path
  const resolved_path = path.resolve(new_file_path);

  // Restrict to user directories
  const allowed_dirs = [
    os.homedir(),
    app.getPath('documents'),
    app.getPath('desktop'),
    app.getPath('downloads')
  ];

  const is_allowed = allowed_dirs.some(dir =>
    resolved_path.startsWith(path.resolve(dir))
  );

  if (!is_allowed) {
    main_window.webContents.send('error', 'Access denied');
    return;
  }

  // Check extension BEFORE existence (prevent probing)
  const ext = path.extname(resolved_path).toLowerCase();
  if (!allowed_extensions.includes(ext)) {
    main_window.webContents.send('error', 'Unsupported file type');
    return;
  }

  // Now check existence and read
  if (!fs.existsSync(resolved_path)) {
    main_window.webContents.send('error', 'File not found');
    return;
  }

  try {
    stop_file_watcher();
    file_path = resolved_path;
    file_content = fs.readFileSync(file_path, 'utf-8');
    // ... rest of handler
  } catch (err) {
    main_window.webContents.send('error', 'Failed to read file');
  }
});
```

### Option 2: Path Normalization Only
**Pros:**
- Simpler
- Allows files from any location

**Cons:**
- Still allows reading sensitive files if they have .md extension
- Doesn't fully mitigate the vulnerability

**Effort:** Small (5 minutes)
**Risk:** Medium (incomplete fix)

### Option 3: Native File Dialog
**Pros:**
- OS-level security
- No custom validation needed

**Cons:**
- Worse UX (can't drag-drop to open)
- Defeats purpose of drag-drop feature

**Effort:** Medium (30 minutes)
**Risk:** Low (but breaks feature intent)

## Recommended Action

**Implement Option 1** - Path normalization with directory allowlist is the industry-standard solution for this vulnerability.

## Technical Details

**Affected Components:**
- `src/main.js` - `open-file` IPC handler

**Security Impact:**
- OWASP A01: Broken Access Control
- CWE-22: Path Traversal
- Severity: HIGH

**Files to Modify:**
- `/Users/randallnoval/Code/markpane/src/main.js` (lines 667-711)

## Acceptance Criteria

- [x] Path normalization using `path.resolve()`
- [x] Directory allowlist enforcement
- [x] Extension check before existence check
- [x] Generic error messages (no path leakage)
- [ ] Test with traversal paths: `../../../../etc/hosts`
- [ ] Test with allowed dirs: `~/Documents/test.md`
- [ ] Test with disallowed dirs: `/etc/passwd.md`

## Work Log

*Findings recorded from security-sentinel agent review on 2025-02-15*

## Resources

- Agent Review: security-sentinel (ae1d9c2)
- OWASP: https://owasp.org/www-community/attacks/Path_Traversal
- Electron Security: https://www.electronjs.org/docs/latest/tutorial/security
