# Error Message Information Disclosure

## Metadata
```yaml
status: pending
priority: p3
issue_id: 014
tags: [code-review, security, information-disclosure]
dependencies: []
```

## Problem Statement

Error messages sent to renderer include filesystem details like file paths, extensions, and system error messages. If renderer is compromised, these details help attackers map filesystem structure.

**Why it matters:** Information leakage aids path traversal attacks. Following principle of least privilege, error messages should be generic.

## Findings

**Source:** security-sentinel agent review
**Location:** `/Users/randallnoval/Code/markpane/src/main.js:678, 688, 708`

**Current errors:**
```javascript
main_window.webContents.send('error', `File not found: ${new_file_path}`);
main_window.webContents.send('error', `Unsupported file type: ${ext}\nAllowed: ${allowed_extensions.join(', ')}`);
main_window.webContents.send('error', `Failed to read file: ${err.message}`);
```

**Information leaked:**
- Full file paths
- File extensions
- System error details
- Allowed extensions list

**Impact:** Information leakage aids attackers in path traversal attempts.

## Proposed Solutions

### Option 1: Generic Error Messages (Recommended)
**Pros:**
- Minimal information disclosure
- Follows security best practice
- Simple to implement

**Cons:**
- Less debugging info for users

**Effort:** Small (5 minutes)
**Risk:** None

**Implementation:**
```javascript
// Log detailed errors server-side, send generic message to renderer
if (!fs.existsSync(resolved_path)) {
  console.error('File not found:', resolved_path);
  main_window.webContents.send('error', 'File not found');
  return;
}

if (!allowed_extensions.includes(ext)) {
  console.error('Unsupported type:', ext, 'for', resolved_path);
  main_window.webContents.send('error', 'Unsupported file type');
  return;
}

try {
  // ...
} catch (err) {
  console.error('File read failed:', err, 'for', resolved_path);
  main_window.webContents.send('error', 'Failed to read file');
}
```

### Option 2: Keep Current (Not Recommended)
**Pros:**
- Better user experience (more details)

**Cons:**
- Security information leak

**Effort:** None
**Risk:** Low (but violates principle)

## Recommended Action

**Implement Option 1** - Generic errors to renderer, detailed logs to console.

## Technical Details

**Security Impact:**
- Severity: LOW
- OWASP: Information Exposure

**Files to Modify:**
- `/Users/randallnoval/Code/markpane/src/main.js` (lines 678, 688, 708)

## Acceptance Criteria

- [ ] Generic error messages to renderer
- [ ] Detailed error logs to console
- [ ] Test: trigger each error, verify generic message shown
- [ ] Test: check console for detailed logs

## Work Log

*Findings recorded from security-sentinel agent review on 2025-02-15*

## Resources

- Agent Review: security-sentinel (ae1d9c2)
- OWASP: Information Exposure
