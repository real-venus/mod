# Unified Interface Component Structure

## Visual Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     UnifiedInterface.tsx                       │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Tab Navigation: [API] [App] [Code]                      │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │  Active Panel Content (one of three):                   │ │
│  │                                                          │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │  ApiPanel.tsx  OR  AppPanel.tsx  OR  CodePanel.tsx │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Footer: Keyboard shortcuts hint                        │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

## ApiPanel.tsx Layout

```
┌────────────────────────────────────────────────────────────┐
│ ApiPanel                                                   │
├───────────────────────┬────────────────────────────────────┤
│ Function List (Left)  │  Interaction Panel (Right)         │
│                       │                                    │
│ ┌─────────────────┐   │  ┌──────────────────────────────┐ │
│ │ 🔍 Search       │   │  │  FN: selected_function       │ │
│ │ [____________]  │   │  └──────────────────────────────┘ │
│ └─────────────────┘   │                                    │
│                       │  ┌──────────────────────────────┐ │
│ ┌─────────────────┐   │  │  fn signature(params)        │ │
│ │ fn generate     │   │  └──────────────────────────────┘ │
│ │   prompt: str   │   │                                    │
│ │   → string      │   │  ┌──────────────────────────────┐ │
│ ├─────────────────┤   │  │  Parameter Inputs:           │ │
│ │ fn analyze      │   │  │  prompt: [____________]      │ │
│ │   text: str     │   │  │  max_tokens: [____100____]   │ │
│ │   → object      │   │  └──────────────────────────────┘ │
│ ├─────────────────┤   │                                    │
│ │ fn search       │   │  ┌──────────────────────────────┐ │
│ │   query: str    │   │  │  [⚡ Execute Function]       │ │
│ │   → array       │   │  └──────────────────────────────┘ │
│ └─────────────────┘   │                                    │
│                       │  ┌──────────────────────────────┐ │
│ (Scrollable list)     │  │  Results / Error Display     │ │
│                       │  │  {...json output...}         │ │
│                       │  └──────────────────────────────┘ │
└───────────────────────┴────────────────────────────────────┘
```

## AppPanel.tsx Layout

```
┌────────────────────────────────────────────────────────────┐
│ AppPanel                                                   │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                                             [🌐 Open] │ │
│  │                                                       │ │
│  │                                                       │ │
│  │            iframe: mod.url_app                        │ │
│  │                                                       │ │
│  │            (App loads here)                           │ │
│  │                                                       │ │
│  │                                                       │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  Loading state: Shows spinner while iframe loads          │
│  Error state: Shows error message if URL invalid/fails    │
└────────────────────────────────────────────────────────────┘
```

## CodePanel.tsx Layout

```
┌────────────────────────────────────────────────────────────┐
│ CodePanel                                                  │
├────────────────────────────────────────────────────────────┤
│ Header: 🔍 Search [____________]  │  10 files · 234 ln    │
├───────────────────┬────────────────────────────────────────┤
│ File Tree (Left)  │  Code Viewer (Right)                   │
│                   │                                        │
│ ┌───────────────┐ │  ┌──────────────────────────────────┐ │
│ │ 📁 src        │ │  │  📄 src/main.py    [python] [#]  │ │
│ │  ├─📄 main.py │ │  └──────────────────────────────────┘ │
│ │  ├─📁 api     │ │                                        │
│ │  │  └─📄 *.py │ │  ┌──┬─────────────────────────────┐   │
│ │  └─📄 util.py │ │  │ 1│ import os                   │   │
│ │ 📁 tests      │ │  │ 2│ import sys                  │   │
│ │  └─📄 test.py │ │  │ 3│                             │   │
│ │ 📄 README.md  │ │  │ 4│ def main():                 │   │
│ │ 📄 package.js │ │  │ 5│     print("Hello")          │   │
│ └───────────────┘ │  │ 6│                             │   │
│                   │  │ 7│ if __name__ == "__main__":  │   │
│ (Collapsible)     │  │ 8│     main()                  │   │
│ (Scrollable)      │  └──┴─────────────────────────────┘   │
│                   │                                        │
│                   │  (Scrollable with line numbers)        │
└───────────────────┴────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────┐
│   Parent    │
│  Component  │
└──────┬──────┘
       │
       │ props: { mod, client, defaultTab }
       ▼
┌─────────────────────────────────────────┐
│       UnifiedInterface.tsx              │
│  ┌────────────────────────────────────┐ │
│  │ State:                             │ │
│  │ - activeTab                        │ │
│  │ - availableTabs (computed)         │ │
│  └────────────────────────────────────┘ │
└──────┬────────────┬────────────┬────────┘
       │            │            │
       │ mod+client │            │
       ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ ApiPanel │ │ AppPanel │ │CodePanel │
└────┬─────┘ └────┬─────┘ └────┬─────┘
     │            │            │
     │            │            │
     ▼            ▼            ▼
┌─────────────────────────────────────┐
│  Client API Calls                   │
│  - client.call(fn, params)          │
│  - client.call('get', { cid })      │
└─────────────────────────────────────┘
```

## State Management

### UnifiedInterface State

```typescript
{
  activeTab: 'api' | 'app' | 'code',
  availableTabs: computed from mod data
}
```

### ApiPanel State

```typescript
{
  selectedFunction: string,
  params: Record<string, any>,
  result: any,
  loading: boolean,
  error: string | null,
  fnSearch: string,
  copied: boolean
}
```

### AppPanel State

```typescript
{
  loading: boolean,
  error: string | null
}
```

### CodePanel State

```typescript
{
  searchTerm: string,
  selectedFile: string | null,
  fileTree: FileNode[],
  expandedFolders: Set<string>,
  fileContents: Record<string, string>,
  copied: boolean
}
```

## File Organization

```
components/
├── UnifiedInterface.tsx           # Main container
├── README.md                      # Component documentation
└── panels/
    ├── ApiPanel.tsx              # API interaction
    ├── AppPanel.tsx              # App preview
    └── CodePanel.tsx             # Code viewer

examples/
└── UnifiedInterfaceExample.tsx   # Usage example

UNIFIED_INTERFACE_DESIGN.md       # Design document
INTEGRATION_GUIDE.md              # Integration guide
COMPONENT_STRUCTURE.md            # This file
```

## Props Flow

```
User App
  └─ provides: { mod, client, defaultTab }
     └─ UnifiedInterface
        ├─ passes to ApiPanel: { mod, client }
        ├─ passes to AppPanel: { mod }
        └─ passes to CodePanel: { mod, client }
```

## Event Flow

### API Panel Events

```
User clicks function
  → setSelectedFunction()
  → Reset params, result, error

User changes param
  → handleParamChange(key, value)
  → Update params state

User clicks Execute
  → handleExecute()
  → setLoading(true)
  → client.call(fnpath, params)
  → setResult() or setError()
  → setLoading(false)

User clicks Copy
  → copyToClipboard(result)
  → setCopied(true)
  → setTimeout → setCopied(false)
```

### App Panel Events

```
Component mounts
  → Validate mod.url_app
  → setLoading(false) if valid

iframe loads
  → onLoad() → setLoading(false)

iframe errors
  → onError() → setError()
```

### Code Panel Events

```
Component mounts
  → buildFileTree(files)
  → Auto-select first file

User clicks file
  → handleFileSelect(node)
  → setSelectedFile(path)
  → Fetch content if not cached
  → client.call('get', { cid })
  → Update fileContents

User clicks folder
  → toggleFolder(path)
  → Update expandedFolders Set

User searches
  → setSearchTerm()
  → Auto-expand matching folders
```

## Responsive Behavior

### Desktop (>1024px)
- Side-by-side panels (file tree + code, function list + params)
- Full-width iframe
- All features visible

### Tablet (768px - 1024px)
- Narrower sidebars
- Smaller font sizes
- Compact spacing

### Mobile (<768px)
- Stacked layout (vertical)
- Collapsible sidebars
- Touch-optimized buttons
- Simplified navigation

## Performance Considerations

### Lazy Loading
- File contents loaded on-demand
- Only active tab rendered
- Panels unmount when tab switches

### Memoization
- FileTree computed once per content change
- Stats computed from cached file contents
- Client calls memoized to prevent re-fetches

### Virtualization
- Long function lists scrollable
- Large file trees scrollable
- Code viewer with line numbers optimized

## Styling System

### Theme Variables
All panels use consistent CSS variables from mod design system.

### Dark/Light Mode
Automatically adapts via CSS variable changes.

### Responsive Units
- rem/em for spacing
- viewport units for large containers
- Fixed px for borders and fine details

## Accessibility

### Keyboard Navigation
- Tab through interactive elements
- Enter to select/execute
- Arrow keys in file tree
- Escape to clear search

### Screen Readers
- Semantic HTML elements
- ARIA labels on buttons
- Alt text on icons
- Role attributes

### Color Contrast
- WCAG AA compliant
- High contrast mode support
- Color-blind friendly

## Browser Compatibility

### Supported
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Features Used
- CSS Grid & Flexbox
- CSS Variables
- ES2020+ JavaScript
- React 18 features
- iframe sandbox
- Clipboard API
