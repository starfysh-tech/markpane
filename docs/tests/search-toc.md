# Search & TOC Edge Cases (Session 7)

## Search Functionality Tests

### Basic Search
Press `Cmd+F` to open search and test the following scenarios.

### Target Word: "searchterm"
The word searchterm appears multiple times in this document. Use search to find all occurrences and verify the match counter.

Here's another occurrence of searchterm in a different section.

Third searchterm for navigation testing.

Fourth searchterm to verify counter accuracy.

Fifth searchterm occurrence.

Sixth searchterm for cycle testing.

Seventh searchterm to ensure proper indexing.

Final searchterm for complete coverage.

### Target Word: "specific"
This is a specific test for a different search term. The word specific should be findable and distinct from "searchterm".

Another specific occurrence here.

### Case Sensitivity Test
Search for "SEARCHTERM" (uppercase) vs "searchterm" (lowercase) to verify case handling.

SEARCHTERM in uppercase.
SearchTerm in mixed case.
searchterm in lowercase.

### Special Characters in Search
Test searching for these patterns:
- Dashes: test-pattern appears here and test-pattern there
- Underscores: var_name and another var_name
- Dots: file.txt and another file.txt reference
- Symbols: $variable and another $variable

### Partial Word Matches
Test if search finds partial matches:
- "search" should match "searchterm", "searching", "searches"
- "term" should match "searchterm", "terminal", "determine"

### Search in Code Blocks
```python
# searchterm in code comment
def search_function():
    result = "searchterm in string"
    return result
```

```javascript
// searchterm in JavaScript
const searchterm = "value";
console.log("searchterm");
```

### Search in Links
Link with search target: [searchterm](https://example.com/searchterm)

### Search in Formatting
**Bold searchterm** and *italic searchterm* and `code searchterm`.

### Search Across Headings
The word searchterm in headings is tested below.

## TOC (Table of Contents) Tests

Press `Cmd+Shift+T` to open the TOC sidebar.

### Level 1 Heading (H1)
This H1 should appear in TOC.

### Level 2 Heading (H2)
This H2 should appear in TOC.

#### Level 3 Heading (H3)
This H3 should appear in TOC.

##### Level 4 Heading (H4)
This H4 should appear in TOC.

###### Level 5 Heading (H5)
This H5 might be filtered depending on depth setting.

### TOC Navigation Test

Click on TOC items to verify scroll-to-section functionality.

#### Section A
Content for section A. Click "Section A" in TOC to scroll here.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

#### Section B
Content for section B. Click "Section B" in TOC to scroll here.

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

#### Section C
Content for section C. Click "Section C" in TOC to scroll here.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

### Scroll Spy Test

Scroll through this document and watch the TOC highlight update to show the current section.

#### Current Section Indicator A
This section tests scroll spy highlighting in the TOC.

Spacer content to enable scrolling.
Spacer content to enable scrolling.
Spacer content to enable scrolling.
Spacer content to enable scrolling.
Spacer content to enable scrolling.

#### Current Section Indicator B
The TOC should highlight this section when scrolled into view.

Spacer content to enable scrolling.
Spacer content to enable scrolling.
Spacer content to enable scrolling.
Spacer content to enable scrolling.
Spacer content to enable scrolling.

#### Current Section Indicator C
The TOC should highlight this section when scrolled into view.

Spacer content to enable scrolling.
Spacer content to enable scrolling.
Spacer content to enable scrolling.
Spacer content to enable scrolling.
Spacer content to enable scrolling.

### TOC with Special Characters

#### Heading with `code`
This heading has inline code.

#### Heading with **bold**
This heading has bold text.

#### Heading with *italic*
This heading has italic text.

#### Heading with [link](https://example.com)
This heading has a link.

#### Heading with "quotes"
This heading has smart quotes.

#### Heading with -- dash
This heading has an em-dash.

### TOC with Long Headings

#### This is a very long heading that should test how the TOC handles overflow and wrapping of heading text in the sidebar panel
Content under long heading.

#### Another exceptionally long heading to verify the TOC can handle multiple lengthy headings without breaking the layout or causing UI issues
Content under another long heading.

### Duplicate Heading Names

#### Duplicate
First occurrence of "Duplicate" heading.

#### Duplicate
Second occurrence of "Duplicate" heading. TOC should handle this.

#### Duplicate
Third occurrence. Verify anchor links are unique.

## Search Navigation Tests

### Forward Navigation (Cmd+G)
1. Search for "searchterm"
2. Press `Cmd+G` repeatedly
3. Verify cycling forward through all matches
4. Verify wrapping from last to first

### Backward Navigation (Cmd+Shift+G)
1. Search for "searchterm"
2. Press `Cmd+Shift+G` repeatedly
3. Verify cycling backward through all matches
4. Verify wrapping from first to last

### Edge Cases

#### No Matches
Search for "xyznonexistent" to verify "0 of 0" or similar message.

#### Single Match
Search for "uniqueword123" to verify "1 of 1" counter.

uniqueword123 is the only occurrence.

#### Many Matches
The letter 'e' appears many times. Search for 'e' to test performance and counter with large match count.

## Search Escape Behavior

### Close Search (Escape)
1. Open search with `Cmd+F`
2. Press `Escape`
3. Verify search panel closes
4. Verify window does NOT close
5. Verify document remains open

## Search Persistence

### Search State Across Files
1. Search for "searchterm" in this file
2. Drag a different .md file onto window
3. Verify search persists or resets appropriately

## Search Highlighting

### Visual Feedback
Search for "highlight" to verify:
- Current match has distinct highlight color
- Other matches have secondary highlight color
- Highlight updates as you navigate matches

The word highlight appears here.
Another highlight occurrence.
Final highlight for testing.

## TOC Collapsing (If Implemented)

### Parent Section
If TOC supports collapsing:
- Verify parent sections can collapse/expand
- Verify nested headings hide when parent is collapsed

#### Nested Child 1
Content under nested child.

#### Nested Child 2
More nested content.

## Long Document Scroll Test

This section adds content to make the document long enough to test:
- Scroll spy accuracy
- TOC highlighting at various scroll positions
- Search match visibility (scrolling to off-screen matches)

---

Spacer section 1
Spacer section 1
Spacer section 1
Spacer section 1
Spacer section 1

---

Spacer section 2
Spacer section 2
Spacer section 2
Spacer section 2
Spacer section 2

---

Spacer section 3
Spacer section 3
Spacer section 3
Spacer section 3
Spacer section 3

---

Spacer section 4
Spacer section 4
Spacer section 4
Spacer section 4
Spacer section 4

---

Spacer section 5
Spacer section 5
Spacer section 5
Spacer section 5
Spacer section 5

---

## Final Section for TOC

### Last Heading

This is the final heading to verify TOC includes all sections from top to bottom.

The word searchterm appears one last time to test search scrolling to the end of the document.

---

## Verification Checklist

1. Search finds all "searchterm" occurrences (count: 8+)
2. `Cmd+G` cycles forward through matches
3. `Cmd+Shift+G` cycles backward through matches
4. `Escape` closes search without closing window
5. TOC shows all headings (H1-H4 minimum)
6. Clicking TOC heading scrolls to section
7. Scroll spy highlights current section in TOC
8. Search highlights current match distinctly
9. Search counter accurate ("X of Y")
10. TOC handles long headings gracefully
11. TOC handles duplicate heading names
12. Search works in code blocks, links, formatting
13. Special characters in headings render in TOC
