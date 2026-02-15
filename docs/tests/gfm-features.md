# GFM Features Edge Cases (Session 2)

## Task Lists

### Basic Task Lists
- [ ] Unchecked task
- [x] Checked task
- [ ] Another unchecked
- [x] Another checked

### Nested Task Lists (3 levels)
- [x] Level 1 completed
  - [x] Level 2 completed
    - [x] Level 3 completed
  - [ ] Level 2 pending
    - [ ] Level 3 pending
- [ ] Level 1 pending
  - [x] Level 2 completed under pending parent
  - [ ] Level 2 pending

### Task Lists with Formatting
- [x] **Bold task** completed
- [ ] *Italic task* pending
- [x] Task with `inline code`
- [ ] Task with [link](https://example.com)
- [x] ~~Strikethrough~~ completed task

### Mixed Lists (Tasks + Regular)
- Regular bullet point
- [x] Completed task
- Another regular bullet
- [ ] Pending task
  - Regular nested
  - [x] Nested task

### Edge Cases
- [] Empty brackets (not a task)
- [X] Capital X (should still work)
- [ x] Space before X (invalid, should not render as checkbox)
- [  ] Multiple spaces (invalid)

## Strikethrough

### Basic Strikethrough
~~This text is struck through~~

Normal text ~~struck~~ normal again.

### Nested Strikethrough
~~This has **bold** and *italic* inside~~

### Multiple on Same Line
~~First~~ normal ~~second~~ normal ~~third~~

### Edge Cases
~single tilde~ should not strike

~~~ triple tildes ~~~ (might conflict with code fence)

~~Unclosed strikethrough

Closed but opened later~~ ~~valid~~

## Linkify (Autolink)

### HTTP/HTTPS URLs
https://github.com/anthropics/peekdown
http://example.com
https://docs.anthropic.com/claude/docs

### URLs in Text
Check out https://github.com for more info.

Visit http://example.com or https://google.com for details.

### URLs with Paths and Query Params
https://github.com/anthropics/peekdown/blob/main/README.md
https://example.com/path/to/page?param=value&other=123

### Edge Cases
https://example.com. (URL followed by period)
https://example.com, (URL followed by comma)
(https://example.com) (URL in parentheses)

Not a URL: github.com (missing protocol)

Mixed: See https://example.com for details.

### URLs with Special Characters
https://example.com/path_(with)_parens
https://example.com/path-with-dash
https://example.com/path_with_underscore

## Typographer (Smart Quotes, Dashes, Ellipsis)

### Smart Quotes
"Double quotes should be curly"

'Single quotes should be curly'

"Nested 'quotes' inside" quotes

### Edge Cases
"Quotes at start and end"
Quote "in the middle" of text
Multiple "quoted" sections "here"

### Dashes
Em-dash: Use -- for em-dash
En-dash: Use --- for en-dash (if supported)

Hyphens vs dashes: word-word vs sentence -- continuation

### Ellipsis
Three dots... should become ellipsis

Text... more text... and more...

Edge case: Four dots.... should be ellipsis + period

### Combined Typography
"Smart quotes" with em-dash -- and ellipsis...

'It works' -- beautifully...

## Tables (GFM Extension)

### Basic Table
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |

### Aligned Columns
| Left | Center | Right |
|:-----|:------:|------:|
| L1   | C1     | R1    |
| L2   | C2     | R2    |
| L3   | C3     | R3    |

### Table with Formatting
| **Bold** | *Italic* | `Code` |
|----------|----------|--------|
| **B1**   | *I1*     | `C1`   |
| Normal   | Text     | Here   |

### Table with Links
| Name     | Link                     |
|----------|--------------------------|
| GitHub   | https://github.com       |
| Anthropic| https://anthropic.com    |

### Minimal Table (2 columns)
| A | B |
|---|---|
| 1 | 2 |

### Wide Table (6+ columns)
| C1 | C2 | C3 | C4 | C5 | C6 |
|----|----|----|----|----|---- |
| D1 | D2 | D3 | D4 | D5 | D6 |

### Table with Long Content
| Column 1 | Column 2 |
|----------|----------|
| This is a very long cell content that should test wrapping behavior | Short |
| Short | This is another very long cell that tests how tables handle overflow |

### Table with Special Characters
| Character | HTML Entity |
|-----------|-------------|
| <         | &lt;        |
| >         | &gt;        |
| &         | &amp;       |
| "         | &quot;      |

## Combined GFM Features

Paragraph with **bold**, *italic*, ~~strikethrough~~, `code`, and [link](https://example.com).

- [x] Task with https://github.com autolink
- [ ] Task with "smart quotes" and -- em-dash
- [x] ~~Completed~~ task with *emphasis*

| Feature | Status | Link |
|---------|--------|------|
| Task Lists | [x] | https://github.com |
| Smart Quotes | "Ready" | -- |
| Linkify | Active | https://example.com |

Quote with features:
> This has "smart quotes" and -- em-dash
> Plus https://example.com autolink
> And ~~strikethrough~~ text

## Edge Case Combinations

### Strikethrough + Links
~~https://github.com~~ (struck link)
~~[Struck link text](https://example.com)~~

### Task Lists in Blockquotes
> - [x] Task in quote
> - [ ] Another task in quote

### URLs in Code Blocks
```
https://github.com (should not linkify inside code)
```

Inline code: `https://github.com` (should not linkify)

### Typography Disabled in Code
Code: `"quotes" -- dash ... ellipsis` (should remain literal)

Block code:
```
"quotes"
-- dash
... ellipsis
```
