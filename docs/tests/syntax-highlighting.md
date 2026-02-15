# Syntax Highlighting Edge Cases (Session 1)

## Standard Languages

### JavaScript
```javascript
// Arrow functions, template literals, destructuring
const { name, age } = user;
const greet = (name) => `Hello, ${name}!`;
const result = await fetch('/api/data').then(r => r.json());
```

### Python
```python
# List comprehension, decorators, context managers
@cache
def process(data: List[str]) -> Dict[str, int]:
    return {k: len(v) for k, v in data.items()}

with open('file.txt', 'r') as f:
    content = f.read()
```

### SQL
```sql
-- Complex query with CTEs, window functions
WITH recent_orders AS (
  SELECT
    user_id,
    order_date,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_date DESC) as rn
  FROM orders
)
SELECT * FROM recent_orders WHERE rn = 1;
```

### Bash
```bash
#!/bin/bash
# Function definition, parameter expansion, command substitution
process_files() {
  local dir="${1:-./}"
  find "$dir" -type f -name "*.md" | while IFS= read -r file; do
    echo "Processing: ${file##*/}"
    wc -l "$file"
  done
}
```

### CSS
```css
/* Modern CSS: variables, grid, animations */
:root {
  --primary: hsl(220, 90%, 56%);
  --spacing: clamp(1rem, 2vw, 2rem);
}

.container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing);
  animation: fadeIn 0.3s ease-in;
}
```

### JSON
```json
{
  "name": "edge-case-test",
  "nested": {
    "array": [1, 2, 3],
    "boolean": true,
    "null_value": null
  },
  "unicode": "Hello 世界 🚀",
  "escaped": "Line\nBreak\tTab\"Quote"
}
```

## Edge Cases

### Empty Block
```

```

### Whitespace Only
```


```

### Single Line
```js
const x = 42;
```

### No Language Specified (Auto-detect)
```
function autoDetect() {
  console.log('Should detect JavaScript');
}
```

### Special HTML Characters
```html
<div class="test" data-value="&amp;&lt;&gt;">
  <!-- Comment with chars: <>&"' -->
  <script>alert("XSS test: <>&'\"");</script>
</div>
```

### Unicode and Emojis in Code
```python
# Unicode identifiers and emojis
def 你好(name):
    emoji = "🚀🎉✨"
    return f"{emoji} Hello {name}!"
```

### Very Long Lines
```javascript
const veryLongVariableName = "This is a very long string that should test horizontal scrolling and wrapping behavior in the code block to ensure the UI handles it gracefully without breaking the layout or causing overflow issues that would impact readability";
```

### Deeply Nested Structures
```json
{
  "level1": {
    "level2": {
      "level3": {
        "level4": {
          "level5": {
            "level6": {
              "deep": "value"
            }
          }
        }
      }
    }
  }
}
```

### Mixed Quotes and Escapes
```javascript
const str1 = "Double \"quotes\" with 'single' inside";
const str2 = 'Single \'quotes\' with "double" inside';
const str3 = `Template ${str1} with ${str2}`;
const regex = /[\"\']|\\n|\\t/g;
```

### Comments in Various Languages
```python
# Python single-line comment
"""
Python multi-line
docstring comment
"""
```

```javascript
// JavaScript single-line comment
/*
 * JavaScript multi-line
 * block comment
 */
```

```css
/* CSS comment */
/* Multi-line
   CSS comment */
```

### Code with Syntax Errors (Should Still Highlight)
```python
# Invalid Python - should still highlight
def broken_function(
    print("Missing closing paren"
    return invalid syntax here
```

### Large Code Block (50+ lines)
```javascript
// Large block to test scrolling and performance
class DataProcessor {
  constructor(options = {}) {
    this.data = options.data || [];
    this.filters = options.filters || [];
    this.cache = new Map();
  }

  process() {
    console.log('Starting data processing...');

    const filtered = this.data.filter(item => {
      return this.filters.every(filter => filter(item));
    });

    const transformed = filtered.map(item => ({
      id: item.id,
      name: item.name?.toUpperCase() ?? 'UNKNOWN',
      timestamp: new Date().toISOString(),
      metadata: {
        source: item.source || 'default',
        priority: item.priority ?? 0,
        tags: item.tags || []
      }
    }));

    const sorted = transformed.sort((a, b) => {
      return b.metadata.priority - a.metadata.priority;
    });

    const grouped = sorted.reduce((acc, item) => {
      const key = item.metadata.source;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {});

    const result = {
      total: sorted.length,
      groups: grouped,
      processed_at: new Date().toISOString(),
      stats: {
        filtered_count: this.data.length - filtered.length,
        group_count: Object.keys(grouped).length
      }
    };

    this.cache.set('last_result', result);

    console.log('Processing complete:', result.stats);

    return result;
  }

  clearCache() {
    this.cache.clear();
  }
}
```

## Language Coverage

Test highlighting for all supported languages:

### TypeScript
```typescript
interface User {
  id: number;
  name: string;
  email?: string;
}

function greet<T extends User>(user: T): string {
  return `Hello, ${user.name}!`;
}
```

### Ruby
```ruby
# Ruby with symbols, blocks, string interpolation
class User
  attr_reader :name, :email

  def initialize(name:, email:)
    @name = name
    @email = email
  end

  def greet
    "Hello, #{@name}!"
  end
end
```

### Go
```go
package main

import "fmt"

func main() {
    message := "Hello, World!"
    fmt.Println(message)
}
```

### Rust
```rust
fn main() {
    let numbers: Vec<i32> = vec![1, 2, 3, 4, 5];
    let sum: i32 = numbers.iter().sum();
    println!("Sum: {}", sum);
}
```

### YAML
```yaml
# YAML configuration
app:
  name: peekdown
  version: 1.0.0
  features:
    - markdown
    - mermaid
    - search
  settings:
    theme: auto
    font_size: 14
```
