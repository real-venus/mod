# UI Restructure Summary

## Changes Made

### 1. **Left Sidebar - Tab Navigation**
- Added tab-based navigation with two tabs: **INPUT** and **TASKS**
- **INPUT tab**: Contains the task creation form with:
  - Task description textarea
  - Model selection (Haiku/Sonnet/Opus)
  - Work directory input
  - Task options (Standard/New/Fork modes)
  - Image paste support
  - Submit button
  - All task expansion options merged into this view

- **TASKS tab**: Contains the task list with:
  - Search/filter functionality
  - Status filter buttons
  - Scrollable task list
  - Compact task cards showing status, prompt, and directory

### 2. **Center Panel - Output Display with API/Code Toggle**
- Added view mode toggle at the top:
  - **📡 API OUTPUT**: Shows the Claude API output/terminal
  - **💻 CODE VIEW**: Placeholder for code view (can be implemented later)

- **Reordered content** (output now appears ABOVE task description):
  1. Terminal output (moved to top, takes most space)
  2. Task description panel (moved to bottom, compact info)

### 3. **Right Sidebar - Directory Browser**
- Added new directory tree panel showing:
  - Current working directory structure
  - Expandable folders (📁/📂 icons)
  - File entries (📄 icons)
  - Click to expand/collapse directories

### 4. **Code Organization**
- Created `renderInputTab()` function for input form rendering
- Created `renderTasksTab()` function for task list rendering
- Created `renderDirectoryTree()` function for directory browser
- Removed ~670 lines of duplicate code
- Maintained all existing functionality

## New State Variables
```typescript
const [leftTab, setLeftTab] = useState<"tasks" | "input">("input");
const [viewMode, setViewMode] = useState<"api" | "code">("api");
const [directoryTree, setDirectoryTree] = useState<any[]>([]);
const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
```

## Layout Structure
```
┌────────────────────────────────────────────────────────────┐
│                         HEADER                             │
├──────────────┬─────────────────────────┬───────────────────┤
│              │                         │                   │
│  LEFT PANEL  │    CENTER PANEL         │  RIGHT PANEL      │
│  (35% width) │    (flex-grow)          │  (25% width)      │
│              │                         │                   │
│ ┌──────────┐ │ ┌─────────────────────┐ │ ┌───────────────┐│
│ │INPUT|TASKS│ │ │  API | CODE         │ │ │ 📁 DIRECTORY  ││
│ ├──────────┤ │ ├─────────────────────┤ │ ├───────────────┤│
│ │          │ │ │                     │ │ │               ││
│ │ (active  │ │ │  ┌─────────────┐   │ │ │  📂 folder1/  ││
│ │  tab     │ │ │  │   OUTPUT    │   │ │ │    📄 file.ts ││
│ │  content)│ │ │  │  (moved up) │   │ │ │  📁 folder2/  ││
│ │          │ │ │  │             │   │ │ │  📄 README.md ││
│ │          │ │ │  └─────────────┘   │ │ │               ││
│ │          │ │ │                     │ │ │               ││
│ │          │ │ │  ┌─────────────┐   │ │ │               ││
│ │          │ │ │  │TASK DETAILS │   │ │ │               ││
│ │          │ │ │  │(moved down) │   │ │ │               ││
│ │          │ │ │  └─────────────┘   │ │ │               ││
│ └──────────┘ │ └─────────────────────┘ │ └───────────────┘│
└──────────────┴─────────────────────────┴───────────────────┘
│                      FOOTER                                │
└────────────────────────────────────────────────────────────┘
```

## Backend API Note
The directory tree feature expects a `/files/tree?path=<path>` endpoint that returns:
```json
{
  "tree": [
    {
      "name": "folder",
      "path": "/full/path/folder",
      "type": "directory",
      "children": [...]
    },
    {
      "name": "file.ts",
      "path": "/full/path/file.ts",
      "type": "file"
    }
  ]
}
```

This endpoint needs to be implemented in the Rust backend (`server/src/main.rs`).

## Build Status
✅ **Build successful** - No TypeScript errors
✅ **Removed 670+ lines** of duplicate code
✅ **All existing features preserved**

## Next Steps (Optional)
1. Implement `/files/tree` endpoint in Rust backend
2. Implement "Code View" mode functionality
3. Add file click handlers in directory tree (open/view files)
4. Add syntax highlighting for code view
5. Add file search in directory tree
