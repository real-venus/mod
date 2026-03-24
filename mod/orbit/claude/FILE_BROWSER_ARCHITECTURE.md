# File Browser Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                      │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  FileTree    │  │  CodeViewer  │  │ FileSearch   │     │
│  │  Component   │  │  Component   │  │  Component   │     │
│  │              │  │              │  │              │     │
│  │ • Tree Nav   │  │ • Syntax     │  │ • Cmd+P      │     │
│  │ • Colors     │  │ • Highlight  │  │ • Fuzzy      │     │
│  │ • Icons      │  │ • Line #s    │  │ • Navigate   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  ┌──────────────┐                                          │
│  │ContentSearch │                                          │
│  │  Component   │                                          │
│  │              │                                          │
│  │ • Cmd+Shift+F│                                          │
│  │ • Regex      │                                          │
│  │ • Highlight  │                                          │
│  └──────────────┘                                          │
│                                                             │
│              │                                              │
│              │ HTTP Requests                                │
│              ▼                                              │
└─────────────────────────────────────────────────────────────┘
               │
               │
┌──────────────┴──────────────────────────────────────────────┐
│                   Backend API (Rust/Axum)                   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   API Endpoints                      │  │
│  │                                                      │  │
│  │  GET /files/tree       → Build directory tree       │  │
│  │  GET /files/content    → Read file contents         │  │
│  │  GET /files/search     → Search file names          │  │
│  │  GET /files/grep       → Search file contents       │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│              │                                              │
│              │ File System Operations                       │
│              ▼                                              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               File System Layer                      │  │
│  │                                                      │  │
│  │  • Recursive directory walking                      │  │
│  │  • File filtering (.git, node_modules, etc.)        │  │
│  │  • Content reading and searching                    │  │
│  │  • Path resolution (~ expansion)                    │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
               │
               │
               ▼
         ┌──────────┐
         │   Disk   │
         │  ~/mod/  │
         └──────────┘
```

## Component Flow

### 1. File Tree Navigation

```
User clicks directory
       │
       ▼
FileTree expands/collapses
       │
       ▼
User clicks file
       │
       ▼
onFileSelect(path) callback
       │
       ▼
Parent updates selectedFile state
       │
       ▼
CodeViewer receives new filePath prop
       │
       ▼
CodeViewer fetches /files/content
       │
       ▼
Content rendered with syntax highlighting
```

### 2. File Search Flow (Cmd+P)

```
User presses Cmd+P
       │
       ▼
FileSearch modal opens
       │
       ▼
User types search query
       │
       ▼
Debounced fetch to /files/search
       │
       ▼
Results displayed with highlighting
       │
       ▼
User navigates with ↑↓ or mouse
       │
       ▼
User presses Enter or clicks
       │
       ▼
onFileSelect(path) callback
       │
       ▼
Modal closes, file opens in CodeViewer
```

### 3. Content Search Flow (Cmd+Shift+F)

```
User presses Cmd+Shift+F
       │
       ▼
ContentSearch modal opens
       │
       ▼
User types search query
       │
       ▼
User toggles options (case, regex)
       │
       ▼
Debounced fetch to /files/grep
       │
       ▼
Matches displayed with context
       │
       ▼
User selects match
       │
       ▼
onFileSelect(path, line) callback
       │
       ▼
Modal closes, file opens at specific line
```

## Data Flow

### File Tree Request/Response

```
Request:
  GET /files/tree?path=~/mod&depth=3

Response:
  {
    "tree": [
      {
        "name": "app",
        "path": "~/mod/app",
        "type": "directory",
        "children": [
          {
            "name": "page.tsx",
            "path": "~/mod/app/page.tsx",
            "type": "file",
            "children": []
          }
        ]
      }
    ],
    "path": "~/mod"
  }

FileTree renders:
  📁 app (expandable)
    └─ 📘 page.tsx (clickable, color: #2b7489)
```

### File Content Request/Response

```
Request:
  GET /files/content?path=~/mod/app/page.tsx

Response:
  {
    "content": "import { useState } from 'react';\n...",
    "path": "~/mod/app/page.tsx"
  }

CodeViewer:
  1. Detects .tsx extension
  2. Maps to language: "tsx"
  3. Passes to SyntaxHighlighter
  4. Renders with VS Code Dark+ theme
  5. Displays with line numbers
```

### File Search Request/Response

```
Request:
  GET /files/search?path=~/mod&query=page

Response:
  {
    "results": [
      {
        "filename": "page.tsx",
        "path": "~/mod/app/page.tsx",
        "matches": 1
      },
      {
        "filename": "page.module.css",
        "path": "~/mod/app/page.module.css",
        "matches": 1
      }
    ]
  }

FileSearch displays:
  page.tsx
  ~/mod/app/page.tsx

  page.module.css
  ~/mod/app/page.module.css
```

### Content Search (Grep) Request/Response

```
Request:
  GET /files/grep?path=~/mod&query=useState&caseSensitive=false

Response:
  {
    "matches": [
      {
        "filename": "page.tsx",
        "path": "~/mod/app/page.tsx",
        "line": 3,
        "content": "import { useState } from 'react';",
        "matchStart": 9,
        "matchEnd": 17
      }
    ]
  }

ContentSearch displays:
  page.tsx :3
  import { useState } from 'react';
          ^^^^^^^^ (highlighted)
  ~/mod/app/page.tsx
```

## Technology Stack

### Frontend Components

```
React (TypeScript)
  │
  ├─ FileTree
  │   └─ Inline styles + file type colors
  │
  ├─ CodeViewer
  │   ├─ react-syntax-highlighter
  │   │   └─ Prism.js
  │   │       └─ vscDarkPlus theme
  │   └─ Language detection by extension
  │
  ├─ FileSearch
  │   ├─ Keyboard navigation
  │   └─ Debounced search (300ms)
  │
  └─ ContentSearch
      ├─ Keyboard navigation
      ├─ Match highlighting
      └─ Options: case sensitive, regex
```

### Backend API

```
Rust + Axum
  │
  ├─ Router
  │   ├─ GET /files/tree
  │   ├─ GET /files/content
  │   ├─ GET /files/search
  │   └─ GET /files/grep
  │
  ├─ File System Operations
  │   ├─ std::fs::read_dir (directory traversal)
  │   ├─ std::fs::read_to_string (file reading)
  │   └─ Path resolution (~ → $HOME)
  │
  └─ Response Serialization
      └─ serde_json
```

## Performance Characteristics

### File Tree
- **Max depth**: 3 levels (configurable)
- **Exclusions**: `.git`, `node_modules`, `__pycache__`, `target`, `.` files
- **Sorting**: Directories first, then alphabetical
- **Lazy loading**: Children loaded on expand

### File Search
- **Max results**: 100 files
- **Max depth**: 10 levels
- **Algorithm**: Case-insensitive substring matching
- **Debounce**: 300ms after typing stops

### Content Search (Grep)
- **Max results**: 200 matches
- **Max depth**: 10 levels
- **Options**: Case sensitive, regex
- **Debounce**: 300ms after typing stops
- **Context**: Full line content with match position

### Code Viewer
- **Syntax highlighting**: Client-side (Prism.js)
- **Theme**: VS Code Dark+
- **Line numbers**: Enabled
- **Max file size**: Handled by browser (no limit in backend)

## Security Considerations

### Path Safety
- All paths resolved through `path.replacen("~", &home, 1)`
- No directory traversal attacks (paths validated)
- Only reads files (no write/delete operations)

### CORS
- Configured with `CorsLayer::new().allow_origin(Any)`
- Suitable for local development
- Should be restricted in production

### File Access
- Read-only operations
- Respects OS file permissions
- No execution of file contents
- No eval or code execution

### Rate Limiting
- Search results capped (100 files, 200 matches)
- Recursion depth limited (10 levels)
- Prevents excessive system load

## Extension Points

### Adding New File Types

**Frontend (FileTree.tsx):**
```typescript
const FILE_COLORS: Record<string, string> = {
  // Add new extension
  ".vue": "#42b883",
};

const FILE_ICONS: Record<string, string> = {
  // Add new icon
  ".vue": "💚",
};
```

**Frontend (CodeViewer.tsx):**
```typescript
const LANGUAGE_MAP: Record<string, string> = {
  // Add new language
  ".vue": "vue",
};
```

### Adding New Search Options

**Backend (api.rs):**
```rust
#[derive(Deserialize)]
struct GrepQuery {
    path: String,
    query: String,
    caseSensitive: bool,
    regex: bool,
    // Add new option
    wholeWord: bool,
}
```

**Frontend (ContentSearch.tsx):**
```typescript
// Add new checkbox
<input
  type="checkbox"
  checked={wholeWord}
  onChange={(e) => setWholeWord(e.target.checked)}
/>
```

## Deployment

### Development
```bash
# Terminal 1: Backend
cd server
cargo run --release

# Terminal 2: Frontend
cd app
npm run dev
```

### Production Build
```bash
# Backend
cd server
cargo build --release
./target/release/claude-jobs

# Frontend
cd app
npm run build
npm start
```

### Environment Variables
```bash
# Backend
export CLAUDE_JOBS_LOCAL=1  # Disable auth for local dev

# Frontend
export NEXT_PUBLIC_API_URL=http://localhost:8820
```

## File Structure

```
/Users/broski/mod/mod/orbit/claude/
│
├── app/
│   ├── src/
│   │   ├── app/
│   │   │   └── page.tsx                  # Main app
│   │   └── components/
│   │       ├── FileTree.tsx              # ✨ File tree
│   │       ├── CodeViewer.tsx            # ✨ Code viewer
│   │       ├── FileSearch.tsx            # ✨ File search
│   │       └── ContentSearch.tsx         # ✨ Content search
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── main.rs
│   │   └── api.rs                        # ✨ New endpoints
│   └── Cargo.toml
│
├── examples/
│   ├── file-browser.tsx                  # ✨ Example usage
│   └── test-file-browser.sh              # ✨ API tests
│
└── docs/
    ├── FILE_BROWSER_GUIDE.md             # ✨ Full guide
    ├── FILE_BROWSER_SUMMARY.md           # ✨ Summary
    └── FILE_BROWSER_ARCHITECTURE.md      # ✨ This file
```

✨ = New files/changes

---

**Architecture designed for**: Performance, extensibility, and simplicity
