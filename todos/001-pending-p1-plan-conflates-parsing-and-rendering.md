---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, architecture, plan-quality]
dependencies: []
---

# Plan Conflates Parsing and Rendering Concerns

## Problem Statement

The enhanced plan for GFM task lists incorrectly assumes all three implementation options only differ in **rendering** approach. In reality, markdown-it doesn't natively parse `- [ ]` syntax as task lists - all options require **parsing changes** first.

**Why it matters:**
- Misleads implementers about actual complexity
- Options B and C still need parsing logic (not just rendering CSS)
- Option C's "no dependency" claim is misleading - you still need to detect `[ ]` patterns

**Severity:** P1 - Blocks accurate implementation

## Findings

**Source:** Architecture-strategist agent review

**Evidence:**
- Plan states Option C uses "Unicode symbols (no `<input>` elements)" but still needs regex to detect `- [ ]` vs `- [x]`
- Option B shows custom `list_item_open` renderer but this only works AFTER markdown-it parses the list item
- markdown-it core doesn't recognize `[x]` as special syntax - it treats it as literal text

**Comparison:**
```javascript
// What the plan implies (WRONG):
md.render('- [ ] task')  // → tokens with task list flag

// What actually happens (RIGHT):
md.render('- [ ] task')  // → tokens with '[ ] task' as plain text
// Need parsing plugin OR pre-processing transform
```

## Proposed Solutions

### Solution 1: Clarify Parsing Requirements (Small effort, low risk)

**Approach:**
Update plan to explicitly state:
- **Option A**: Plugin handles both parsing AND rendering
- **Option B**: Custom renderer works but may miss edge cases (nested lists, etc.)
- **Option C**: Pre-processing transform IS the parser (replaces syntax before markdown-it sees it)

**Pros:**
- Accurate implementation guidance
- Helps choose correct option based on parsing needs

**Cons:**
- Doesn't change recommendation, just clarifies

**Estimated Effort:** 15 minutes (edit plan document)
**Risk:** None

---

### Solution 2: Recommend Parser-Aware Option (Medium effort, medium risk)

**Approach:**
Change plan recommendation to:
- **If want true GFM compliance**: Use Option A (plugin handles parsing correctly)
- **If want simple viewer-only**: Use Option C (transform is simple, no edge cases matter)
- **Avoid Option B**: Custom renderer is harder to get right than it appears

**Pros:**
- Steers toward robust implementations
- Acknowledges parsing complexity

**Cons:**
- Contradicts simplicity review's Option B recommendation
- May confuse implementer with conflicting advice

**Estimated Effort:** 30 minutes (revise recommendations section)
**Risk:** Medium (conflicts with other agent findings)

---

### Solution 3: Add Parsing Validation Tests (Large effort, low risk)

**Approach:**
Regardless of option chosen, add test cases for parsing edge cases:
```markdown
- [ ] Normal task
- [x] Checked task
- [X] Uppercase X
- [ x] No space after bracket
- [  ] Double space
  - [ ] Nested task
```

**Pros:**
- Validates chosen implementation actually works
- Catches parser bugs early

**Cons:**
- Requires test infrastructure (none exists currently)
- Adds scope to Phase 2

**Estimated Effort:** 2-3 hours (write tests + fixture files)
**Risk:** Low (optional enhancement)

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Components:**
- `/Users/randallnoval/Code/markpane/docs/plans/2026-02-14-feat-gfm-parity-task-lists-and-strikethrough-plan.md` (lines 156-184, 311-357, 361-391)

**Root Cause:**
Plan author focused on security and rendering differences between options, didn't analyze parsing layer.

**markdown-it Architecture:**
1. **Parsing**: Source text → tokens (block parser, inline parser)
2. **Rendering**: Tokens → HTML (renderer rules)

Task list syntax (`- [ ]`) must be recognized during parsing (step 1), not just rendering (step 2).

## Acceptance Criteria

- [ ] Plan explicitly states which layer (parsing vs rendering) each option modifies
- [ ] Recommendation section addresses parsing complexity
- [ ] Option B clarifies that custom renderer alone is insufficient
- [ ] Option C clarifies that regex transform IS the parser

## Work Log

### 2026-02-14 - Initial finding
- Identified by architecture-strategist review agent
- Affects plan accuracy and implementation success
- Recommended clarifying parsing vs rendering in plan document

## Resources

- **Related issue:** N/A (plan review finding)
- **Plan document:** `/Users/randallnoval/Code/markpane/docs/plans/2026-02-14-feat-gfm-parity-task-lists-and-strikethrough-plan.md`
- **markdown-it parsing docs:** https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md
- **Agent report:** architecture-strategist (agent ID: a8caa01)
