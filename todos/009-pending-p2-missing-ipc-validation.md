# Missing IPC Channel Input Validation

## Metadata
```yaml
status: pending
priority: p2
issue_id: 009
tags: [code-review, security, electron, ipc, validation]
dependencies: []
```

## Problem Statement

The `preload.js` exposes IPC channels without input validation. While main process has some validation, defense-in-depth requires validation at both boundaries.

**Why it matters:** Missing input validation allows malformed data to reach main process, enabling type confusion attacks and IPC channel spam.

## Findings

**Source:** security-sentinel agent review
**Location:** `/Users/randallnoval/Code/markpane/src/preload.js:22-28`

**Current code:**
```javascript
openFile: (file_path) => {
  ipcRenderer.send('open-file', file_path);
},

toggleAlwaysOnTop: () => {
  ipcRenderer.send('toggle-always-on-top');
}
```

**Vulnerability:**
- No type checking on `file_path`
- No length limits (DoS via large strings)
- No rate limiting on `toggleAlwaysOnTop` (spam attacks)

## Proposed Solutions

### Option 1: Add Type Validation + Rate Limiting (Recommended)
**Pros:**
- Defense-in-depth
- Prevents DoS attacks
- Simple to implement

**Cons:**
- Minimal overhead per call

**Effort:** Small (10 minutes)
**Risk:** None

**Implementation:**
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (file_path) => {
    if (typeof file_path !== 'string') {
      console.error('openFile: path must be string');
      return;
    }
    if (file_path.length > 4096) {
      console.error('openFile: path too long');
      return;
    }
    ipcRenderer.send('open-file', file_path);
  },

  toggleAlwaysOnTop: (() => {
    let last_toggle = 0;
    return () => {
      const now = Date.now();
      if (now - last_toggle < 500) {
        return; // Debounce 500ms
      }
      last_toggle = now;
      ipcRenderer.send('toggle-always-on-top');
    };
  })()
});
```

### Option 2: Rely on Main Process Validation
**Pros:**
- Less code

**Cons:**
- Violates defense-in-depth principle
- Doesn't prevent DoS via large payloads

**Effort:** None
**Risk:** Medium (incomplete security model)

## Recommended Action

**Implement Option 1** - Add input validation at preload boundary.

## Technical Details

**Security Impact:**
- OWASP A04: Insecure Design
- Severity: MEDIUM

**Files to Modify:**
- `/Users/randallnoval/Code/markpane/src/preload.js` (lines 22-28)

## Acceptance Criteria

- [ ] Type validation on `openFile` parameter
- [ ] Length limit on file paths (4096 chars)
- [ ] Rate limiting on `toggleAlwaysOnTop` (500ms debounce)
- [ ] Test: send non-string to `openFile` → rejected
- [ ] Test: send 10000-char path → rejected
- [ ] Test: spam `toggleAlwaysOnTop` → throttled

## Work Log

*Findings recorded from security-sentinel agent review on 2025-02-15*

## Resources

- Agent Review: security-sentinel (ae1d9c2)
- Electron Security: https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages
