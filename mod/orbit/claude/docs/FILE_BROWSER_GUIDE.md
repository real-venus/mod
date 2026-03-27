# File Browser Components Guide

## Overview

This guide documents the file browsing system with syntax highlighting, file search, and content search capabilities - similar to VS Code's file explorer.

## Components

### 1. FileTree Component

**Location:** `/app/src/components/FileTree.tsx`

Color-coded file tree with expand/collapse functionality.

**Features:**
- 📁 Directory navigation with expand/collapse
- 🎨 Color-coded file types (Python, JavaScript, Rust, etc.)
- 📊 File type icons
- 🔍 Visual selection highlighting
- 🌲 Nested directory support

**Props:**
```typescript
interface FileTreeProps {
  workDir: string;          // Root directory to display
  onFileSelect: (path: string) => void;  // Called when file is clicked
  selectedFile: string | null;           // Currently selected file path
}
```

**Color Scheme:**
- Python (`.py`): `#3572A5` 🐍
- JavaScript (`.js`): `#f1e05a` 📜
- TypeScript (`.ts`, `.tsx`): `#2b7489` 📘
- Rust (`.rs`): `#dea584` 🦀
- Go (`.go`): `#00ADD8` 🔷
- JSON (`.json`): `#ffb000` 📋
- Markdown (`.md`): `#083fa1` 📝
- Shell (`.sh`): `#89e051` 🔧
- And more...

---

### 2. CodeViewer Component

**Location:** `/app/src/components/CodeViewer.tsx`

Syntax-highlighted code viewer powered by Prism.js.

**Features:**
- 🎨 Syntax highlighting for 20+ languages
- 📊 Line numbers
- 📝 File info header (name, language, line count)
- 🌙 VS Code Dark+ theme
- 📏 Monospace font rendering

**Props:**
```typescript
interface CodeViewerProps {
  filePath: string | null;  // Path to file to display
  workDir: string;          // Base working directory
}
```

**Supported Languages:**
- Python, JavaScript, TypeScript, JSX, TSX
- Rust, Go, Java, C, C++
- JSON, YAML, TOML, XML, HTML, CSS
- Bash, Ruby, PHP, Swift, Kotlin
- And more...

---

### 3. FileSearch Component

**Location:** `/app/src/components/FileSearch.tsx`

Quick file name search modal (like VS Code's Cmd+P).

**Features:**
- ⚡ Real-time search as you type
- ⌨️ Keyboard navigation (↑↓ arrows, Enter, Esc)
- 🔍 Fuzzy file name matching
- 📍 Full path display
- 🎯 Hover and click selection

**Props:**
```typescript
interface FileSearchProps {
  workDir: string;                           // Directory to search
  onFileSelect: (path: string) => void;     // Called when file selected
  isOpen: boolean;                          // Modal open state
  onClose: () => void;                      // Close handler
}
```

**Keyboard Shortcuts:**
- `↑↓` - Navigate results
- `Enter` - Select file
- `Esc` - Close modal

---

### 4. ContentSearch Component

**Location:** `/app/src/components/ContentSearch.tsx`

Search file contents (like VS Code's Cmd+Shift+F).

**Features:**
- 🔍 Full-text search across all files
- 🎯 Match highlighting with context
- ⚙️ Case sensitive option
- 🔢 Regex support
- 📊 Line numbers and file paths
- ⌨️ Keyboard navigation

**Props:**
```typescript
interface ContentSearchProps {
  workDir: string;                                    // Directory to search
  onFileSelect: (path: string, line?: number) => void;  // File + line selection
  isOpen: boolean;                                    // Modal open state
  onClose: () => void;                                // Close handler
}
```

**Options:**
- **Case Sensitive (Aa):** Match exact case
- **Regex (.*):** Use regular expressions

**Keyboard Shortcuts:**
- `↑↓` - Navigate results
- `Enter` - Jump to file/line
- `Esc` - Close modal

---

## Backend API Endpoints

All endpoints are implemented in `/server/src/api.rs`.

### GET `/files/tree`

Get directory tree structure.

**Query Parameters:**
- `path` (optional): Directory path (default: `~/mod`)
- `depth` (optional): Max depth (default: 3)

**Response:**
```json
{
  "tree": [
    {
      "name": "example.py",
      "path": "~/mod/example.py",
      "type": "file",
      "children": []
    },
    {
      "name": "src",
      "path": "~/mod/src",
      "type": "directory",
      "children": [...]
    }
  ],
  "path": "~/mod"
}
```

---

### GET `/files/content`

Get file contents.

**Query Parameters:**
- `path` (required): File path

**Response:**
```json
{
  "content": "file contents...",
  "path": "~/mod/example.py"
}
```

---

### GET `/files/search`

Search for files by name.

**Query Parameters:**
- `path` (required): Directory to search
- `query` (required): Search term

**Response:**
```json
{
  "results": [
    {
      "filename": "example.py",
      "path": "~/mod/src/example.py",
      "matches": 1
    }
  ]
}
```

---

### GET `/files/grep`

Search file contents (grep).

**Query Parameters:**
- `path` (required): Directory to search
- `query` (required): Search term
- `caseSensitive` (optional): Case sensitive (default: false)
- `regex` (optional): Use regex (default: false)

**Response:**
```json
{
  "matches": [
    {
      "filename": "example.py",
      "path": "~/mod/src/example.py",
      "line": 42,
      "content": "def example_function():",
      "matchStart": 4,
      "matchEnd": 11
    }
  ]
}
```

---

## Usage Example

See `/examples/file-browser.tsx` for a complete example.

```typescript
import FileTree from "../app/src/components/FileTree";
import CodeViewer from "../app/src/components/CodeViewer";
import FileSearch from "../app/src/components/FileSearch";
import ContentSearch from "../app/src/components/ContentSearch";

export default function MyFileBrowser() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [workDir] = useState("~/mod/mod/orbit/claude");

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setFileSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        setContentSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* File Tree Sidebar */}
      <div style={{ width: "300px" }}>
        <FileTree
          workDir={workDir}
          onFileSelect={setSelectedFile}
          selectedFile={selectedFile}
        />
      </div>

      {/* Code Viewer */}
      <div style={{ flex: 1 }}>
        <CodeViewer filePath={selectedFile} workDir={workDir} />
      </div>

      {/* Search Modals */}
      <FileSearch
        workDir={workDir}
        onFileSelect={setSelectedFile}
        isOpen={fileSearchOpen}
        onClose={() => setFileSearchOpen(false)}
      />
      <ContentSearch
        workDir={workDir}
        onFileSelect={(path, line) => {
          setSelectedFile(path);
          // TODO: Scroll to line
        }}
        isOpen={contentSearchOpen}
        onClose={() => setContentSearchOpen(false)}
      />
    </div>
  );
}
```

---

## Installation

The components use the following dependencies:

```bash
npm install prismjs react-syntax-highlighter @types/react-syntax-highlighter
```

These are already installed in the `/app` directory.

---

## Keyboard Shortcuts

When integrated into your app:

- **`Cmd+P` (Mac) / `Ctrl+P` (Windows/Linux):** Open file search
- **`Cmd+Shift+F` (Mac) / `Ctrl+Shift+F` (Windows/Linux):** Open content search
- **`↑↓` Arrow keys:** Navigate search results
- **`Enter`:** Select file/result
- **`Esc`:** Close search modal

---

## Styling

All components use inline styles with the following color scheme:

- **Background:** `#0a0a0a` (dark)
- **Secondary background:** `#0f0f0f`, `#1e1e1e`
- **Borders:** `#333`
- **Primary accent:** `#00aaff` (cyan)
- **Success accent:** `#33ff33` (green)
- **Warning accent:** `#ffb000` (orange)
- **Error accent:** `#ff3333` (red)
- **Text primary:** `#fff`
- **Text secondary:** `#666`, `#888`, `#ccc`

The components are designed to match the mod terminal aesthetic.

---

## Integration into Main App

To add file browsing to your main page:

1. **Import components**
2. **Add state for selected file and search modals**
3. **Add keyboard shortcut listeners**
4. **Add UI button/tab to open file browser**
5. **Render components in your layout**

Example integration point in `/app/src/app/page.tsx`:

```typescript
// Add to imports
import FileTree from "../components/FileTree";
import CodeViewer from "../components/CodeViewer";
import FileSearch from "../components/FileSearch";
import ContentSearch from "../components/ContentSearch";

// Add to state
const [showFileBrowser, setShowFileBrowser] = useState(false);
const [selectedFile, setSelectedFile] = useState<string | null>(null);
const [fileSearchOpen, setFileSearchOpen] = useState(false);
const [contentSearchOpen, setContentSearchOpen] = useState(false);

// Add tab/button in your UI
<button onClick={() => setShowFileBrowser(true)}>
  📁 Files
</button>

// Add file browser panel
{showFileBrowser && (
  <div style={{ display: "flex", height: "100%" }}>
    <FileTree workDir={workDir} onFileSelect={setSelectedFile} selectedFile={selectedFile} />
    <CodeViewer filePath={selectedFile} workDir={workDir} />
  </div>
)}
```

---

## Performance Notes

- File tree is loaded incrementally with configurable depth
- Search results are limited to 100 files (file search) and 200 matches (content search)
- Large files may take time to syntax highlight
- Excluded directories: `.git`, `node_modules`, `__pycache__`, `target`
- Hidden files (starting with `.`) are excluded from tree

---

## Future Enhancements

Potential improvements:

- [ ] Line jumping in CodeViewer
- [ ] File editing capabilities
- [ ] Git status indicators
- [ ] File/folder icons from VS Code icon theme
- [ ] Virtual scrolling for large directories
- [ ] File tree filtering
- [ ] Recent files list
- [ ] File preview on hover
- [ ] Regex search in file names
- [ ] Multi-file diff view

---

## Troubleshooting

**Files not loading?**
- Check that the backend server is running (`cargo run --release` in `/server`)
- Verify API_URL in your env (`NEXT_PUBLIC_API_URL`)
- Check browser console for CORS errors

**Syntax highlighting not working?**
- Ensure `prismjs` and `react-syntax-highlighter` are installed
- Check that file extension is mapped in `LANGUAGE_MAP`

**Search not finding files?**
- Verify directory path is correct (use `~` for home)
- Check that files aren't in excluded directories
- Ensure backend search endpoints are working (`curl` test)

---

## File Structure

```
/app/src/components/
├── FileTree.tsx          # Color-coded file tree
├── CodeViewer.tsx        # Syntax highlighted viewer
├── FileSearch.tsx        # File name search modal
└── ContentSearch.tsx     # Content search modal

/server/src/
└── api.rs                # Backend endpoints

/examples/
└── file-browser.tsx      # Complete usage example

FILE_BROWSER_GUIDE.md     # This guide
```

---

## License

Part of the mod framework.
