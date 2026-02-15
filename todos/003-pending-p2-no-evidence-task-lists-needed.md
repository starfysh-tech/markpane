---
status: pending
priority: p2
issue_id: "003"
tags: [code-review, architecture, requirements]
dependencies: []
---

# No Evidence That Task Lists Feature Is Needed

## Problem Statement

The plan implements GFM task lists without validating whether users actually need this feature in a read-only markdown viewer.

**Why it matters:**
- Task lists add security complexity (`<input>` elements)
- Adds code to maintain (custom renderer or plugin dependency)
- All three options have trade-offs and risks
- This is a **viewer**, not a task manager - checkboxes are always disabled

**Severity:** P2 (Important) - Architectural decision, should validate before implementing

## Findings

**Source:** Architecture-strategist agent review

**Key insight:**
> "This is a markdown **viewer**, not a task manager. What evidence exists that task lists are needed?"

**Observations:**
- Roadmap Phase 2 lists task lists as "Common GFM features, expected by users familiar with GitHub markdown"
- No user requests, issues, or feedback mentioned
- Quick Look extension also lacks task lists (so internal parity already achieved without them)
- Strikethrough is the other Phase 2 feature - that one is uncontroversial and low-risk

**Risk of proceeding without validation:**
- Implement complex feature nobody uses
- Add security attack surface for minimal benefit
- Technical debt if feature later needs removal

## Proposed Solutions

### Solution 1: Validate User Demand First (Small effort, low risk)

**Approach:**
Before implementing task lists:
1. Check GitHub issues/discussions for task list requests
2. Survey existing users (if any) about GFM feature priorities
3. Analyze markdown files in test corpus - do they contain `- [ ]` syntax?
4. Consider analytics (if available) - do users view files with task lists?

**Pros:**
- Evidence-based decision making
- Could discover task lists are actually important
- Or could save implementation effort entirely

**Cons:**
- Delays Phase 2 implementation
- May not have user base large enough to survey

**Estimated Effort:** 1-2 hours (research + analysis)
**Risk:** Low

---

### Solution 2: Implement Strikethrough Only (Small effort, low risk) ✅

**Approach:**
- **Ship Phase 2 with just strikethrough** (zero risk, already validated working)
- **Defer task lists** to future phase pending user demand
- Update roadmap: "Phase 2: Strikethrough" and "Phase 2.5: Task Lists (if requested)"

**Pros:**
- Delivers GFM parity for low-hanging fruit
- Avoids security complexity entirely
- Can add task lists later if needed (backward compatible)
- Strikethrough is `md.enable('strikethrough')` - 1 line of code

**Cons:**
- Doesn't complete "full GFM parity" goal
- Users familiar with GitHub might expect task lists

**Estimated Effort:** 15 minutes (update plan, implement strikethrough)
**Risk:** None

---

### Solution 3: Implement Option C (Unicode) as Compromise (Medium effort, low risk)

**Approach:**
- Acknowledge task lists might be useful for visual consistency
- Use Option C (Unicode symbols ☐/☑) to avoid security complexity
- Simple implementation, no `<input>` elements
- If users complain symbols aren't "real" checkboxes, reconsider

**Pros:**
- Provides task list visual rendering
- Zero security risk
- Easy to upgrade to Options A/B later if needed

**Cons:**
- Symbols look different than native checkboxes
- Still implementing feature without proven demand

**Estimated Effort:** 1 hour (implement Option C)
**Risk:** Low

---

### Solution 4: Make Task Lists Optional Feature Flag (Large effort, medium risk)

**Approach:**
Add CLI flag or config option:
```bash
markpane file.md --enable-task-lists
```

Users who need task lists can opt-in. Default is off (safer).

**Pros:**
- Accommodates both use cases
- Security-conscious default
- Can track usage via telemetry (if added)

**Cons:**
- Adds configuration complexity
- Need to design config system (doesn't exist currently)
- Overkill for single feature

**Estimated Effort:** 4-6 hours (config system + CLI flag + docs)
**Risk:** Medium (scope creep)

## Recommended Action

**Recommend Solution 2: Implement strikethrough only, defer task lists.**

**Rationale:**
- Strikethrough has zero controversy (safe, simple, 1 line)
- Task lists have significant security and architectural implications
- No evidence users need task lists in a read-only viewer
- Can always add later if demand materializes

**If task lists ARE required:**
Then recommend Solution 3 (Option C Unicode) as safest implementation.

## Technical Details

**Current Roadmap** (`/Users/randallnoval/Code/markpane/docs/ROADMAP.md:20-29`):
```markdown
## Phase 2: GFM Parity

**Goal**: Support the full GitHub-Flavored Markdown spec.

- [ ] **Task lists** — Render `- [ ]` and `- [x]` as checkboxes
- [ ] **Strikethrough** — Support `~~text~~` syntax
```

**Proposed Revision:**
```markdown
## Phase 2: GFM Parity (Strikethrough)

**Goal**: Support essential GitHub-Flavored Markdown features.

- [ ] **Strikethrough** — Support `~~text~~` syntax (markdown-it built-in)

## Phase 2.5: Task Lists (Deferred pending user demand)

- [ ] **Task lists** — Render `- [ ]` and `- [x]` as checkboxes (if requested)
```

## Acceptance Criteria

- [ ] User demand validated OR decision documented to defer
- [ ] If deferring: Roadmap updated to reflect strikethrough-only Phase 2
- [ ] If implementing: Evidence documented (issues, requests, usage data)

## Work Log

### 2026-02-14 - Initial finding
- Identified by architecture-strategist review agent
- No evidence found that users need task lists
- Recommendation: Ship strikethrough only, defer task lists
- Alternative: Use Option C if task lists required

## Resources

- **Roadmap:** `/Users/randallnoval/Code/markpane/docs/ROADMAP.md`
- **Plan document:** `/Users/randallnoval/Code/markpane/docs/plans/2026-02-14-feat-gfm-parity-task-lists-and-strikethrough-plan.md`
- **Agent report:** architecture-strategist (agent ID: a8caa01)
