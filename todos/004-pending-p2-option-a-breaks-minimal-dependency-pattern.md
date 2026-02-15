---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, architecture, dependencies, patterns]
dependencies: []
---

# Option A Breaks Minimal Dependency Pattern

## Problem Statement

The plan's Option A (plugin-based approach) would add the first external markdown-it plugin, increasing the dependency count from 4 to 5 packages and breaking the project's established minimal dependency pattern.

**Why it matters:**
- Project has maintained 4-package constraint (`package.json:21-25`)
- Increases bundle size by ~5KB
- Adds supply chain risk (external maintainer)
- Contradicts recent simplification efforts (commit `6efac68` moved to CDN builds)

**Severity:** P2 (Important) - Architectural consistency

## Findings

**Source:** Pattern-recognition-specialist agent review

**Current dependencies** (`/Users/randallnoval/Code/markpane/package.json:21-25`):
```json
{
  "dependencies": {
    "markdown-it": "^14.0.0",
    "mermaid": "^10.9.0",
    "dompurify": "^3.0.0",
    "highlight.js": "^11.11.1"
  }
}
```

**Evidence of minimal dependency pattern:**
- Only 4 packages total
- Zero markdown-it plugins (uses built-in features + custom renderers)
- Recent commit history shows moving away from npm complexity toward CDN
- Custom fence renderer exists (lines 9-29) instead of using plugins

**Option A would add:**
```json
{
  "dependencies": {
    "markdown-it-task-lists": "^2.1.1"  // 5th dependency
  }
}
```

**Comparison to other options:**

| Option | Dependencies | Pattern fit |
|--------|--------------|-------------|
| **A: Plugin** | 5 (adds task-lists) | ❌ Breaks pattern |
| **B: Custom Renderer** | 4 (no change) | ✅ Extends existing pattern |
| **C: Unicode** | 4 (no change) | ✅ Consistent |

## Proposed Solutions

### Solution 1: Choose Option B or C (No effort, no risk) ✅

**Approach:**
Select Option B (custom renderer) or Option C (Unicode symbols) from the plan. Both maintain the 4-dependency constraint.

**Pros:**
- Maintains architectural consistency
- No new supply chain risk
- Option B extends existing custom renderer pattern (line 9-29)
- Option C has zero security complexity

**Cons:**
- Option B requires maintaining custom code vs community plugin
- Option C uses symbols instead of native checkboxes

**Estimated Effort:** 0 (decision only)
**Risk:** None

---

### Solution 2: Document Exception to Pattern (Small effort, low risk)

**Approach:**
If Option A is chosen for specific reasons (e.g., better GFM compliance, community maintenance), document why the minimal dependency pattern is being relaxed:

**Update CLAUDE.md:**
```markdown
## Dependencies

**Pattern:** Minimal dependencies (prefer built-in or custom implementations)

**Exceptions:**
- markdown-it-task-lists: Added for GFM spec compliance (Phase 2)
  - Rationale: Complex parsing logic, better maintained by community
  - Trade-off: +5KB bundle, supply chain risk vs implementation effort
```

**Pros:**
- Acknowledges pattern violation
- Documents reasoning for future maintainers
- Allows informed exceptions

**Cons:**
- Doesn't change the fact that pattern is broken
- Sets precedent for future plugin additions

**Estimated Effort:** 15 minutes (update CLAUDE.md)
**Risk:** Low

---

### Solution 3: Audit markdown-it-task-lists Supply Chain (Medium effort, low risk)

**Approach:**
If using Option A, validate the plugin's trustworthiness:
```bash
npm view markdown-it-task-lists time.modified maintainers
npm audit
# Check GitHub for last commit date, issue activity, contributor count
```

**Pros:**
- Validates plugin is actively maintained
- Identifies security risks before adding dependency
- Could reveal plugin is abandoned (supports choosing Option B/C)

**Cons:**
- Effort to audit
- Ongoing monitoring needed (dep-bot, security alerts)

**Estimated Effort:** 30 minutes
**Risk:** Low

## Recommended Action

**Recommend Solution 1: Choose Option B (Custom Renderer)**

**Rationale:**
- Maintains 4-dependency constraint
- Extends existing pattern (lines 9-29 already have custom fence renderer)
- Simple implementation (~10 lines)
- Zero supply chain risk
- Easier to maintain than external plugin

**If Option A absolutely required:**
Then implement Solutions 2 and 3 together (document exception + audit plugin).

## Technical Details

**Affected Files:**
- `/Users/randallnoval/Code/markpane/package.json` (if Option A chosen)
- `/Users/randallnoval/Code/markpane/CLAUDE.md` (if documenting exception)

**Pattern Evolution:**
```
Current: markdown-it + 3 utilities (mermaid, dompurify, highlight.js)
Option A: → 5 deps (adds task-lists plugin) ❌
Option B: → 4 deps (custom renderer) ✅
Option C: → 4 deps (Unicode transform) ✅
```

**Existing Custom Renderer Pattern** (`src/renderer.js:9-29`):
```javascript
const default_fence = md.renderer.rules.fence.bind(md.renderer.rules);

md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const info = (token.info || '').trim();
  const lang = info.split(/\s+/)[0];

  if (lang === 'mermaid') {
    return `<div class="mermaid">${md.utils.escapeHtml(token.content)}</div>`;
  }

  if (lang) {
    token.attrJoin('class', `language-${lang}`);
    token.attrJoin('class', 'hljs');
  }

  return default_fence(tokens, idx, options, env, self);
};
```

Option B would extend this pattern with `list_item_open` renderer (same approach, different rule).

## Acceptance Criteria

- [ ] Implementation option chosen (B or C preferred)
- [ ] If Option A: Exception documented in CLAUDE.md with rationale
- [ ] If Option A: Plugin supply chain audited
- [ ] Dependency count remains at 4 OR increase justified and documented

## Work Log

### 2026-02-14 - Initial finding
- Identified by pattern-recognition-specialist review agent
- Option A breaks 4-dependency pattern
- Option B extends existing custom renderer pattern (recommended)
- Option C maintains pattern with simplest implementation

## Resources

- **Current dependencies:** `/Users/randallnoval/Code/markpane/package.json:21-25`
- **Existing custom renderer:** `/Users/randallnoval/Code/markpane/src/renderer.js:9-29`
- **Plan document:** `/Users/randallnoval/Code/markpane/docs/plans/2026-02-14-feat-gfm-parity-task-lists-and-strikethrough-plan.md`
- **Agent report:** pattern-recognition-specialist (agent ID: a800115)
