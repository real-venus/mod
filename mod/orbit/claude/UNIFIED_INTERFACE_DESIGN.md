# Unified Interface Design

## Overview
A comprehensive 3-panel interface inspired by mod/core/app that combines API interaction, app preview, and code viewing in a single, cohesive experience.

## Architecture

### Tab Structure
```
┌─────────────────────────────────────────────────────────────┐
│  [API] [App] [Code]                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Selected Tab Content:                                      │
│                                                             │
│  • API: Function list + params + execute + results         │
│  • App: iframe with app preview + external link button     │
│  • Code: File tree sidebar + code viewer + search          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Component Structure

**UnifiedInterface.tsx** (Main container)
├── **ApiPanel.tsx** (API interaction - based on ModApi.tsx)
│   ├── Function list sidebar (searchable)
│   ├── Parameter input form
│   ├── Execute button
│   └── Results display (JSON, images, etc.)
│
├── **AppPanel.tsx** (App preview - based on ModApp.tsx)
│   ├── iframe with app URL
│   ├── Loading states
│   ├── Error handling
│   └── "Open in new tab" button
│
└── **CodePanel.tsx** (Code viewer - based on ModContent.tsx)
    ├── File tree sidebar (collapsible folders)
    ├── Code viewer with syntax highlighting
    ├── Search functionality (file names + content)
    └── Copy functionality

## Key Features

### API Tab
- **Function Browser**: Searchable list of all API functions with signatures
- **Smart Inputs**: Type-aware input fields (bool dropdowns, text inputs)
- **Custom Parameters**: Support for kwargs with dynamic param addition
- **Rich Results**: Display JSON, images, or errors with copy functionality
- **Live Execution**: Real-time API calls with loading states

### App Tab
- **iframe Integration**: Seamless app preview
- **Loading States**: Spinner while app loads
- **Error Handling**: Graceful failure with helpful messages
- **External Access**: Button to open app in new tab
- **Permissions**: Proper iframe sandbox attributes

### Code Tab
- **File Tree**: Hierarchical view with folders/files
- **Search**: Filter by filename or content with match highlighting
- **Code Viewer**: Line numbers, syntax detection, copy buttons
- **Version Selector**: Switch between module versions
- **Statistics**: File count, lines, size display
- **CID Display**: Show IPFS CIDs for files

## Data Flow

```typescript
interface UnifiedInterfaceProps {
  mod: {
    name: string
    key: string
    schema?: Record<string, FunctionSchema>  // For API tab
    url_app?: string                         // For App tab
    content?: Record<string, string>         // For Code tab (path -> CID)
  }
  client: ApiClient  // For making API calls and fetching content
}
```

## Styling
- **Design System**: Mod's monospace, terminal-inspired aesthetic
- **CSS Variables**: Use `var(--bg-primary)`, `var(--text-primary)`, etc.
- **Responsive**: Adapt to different screen sizes
- **Consistent**: Match mod/core/app styling exactly

## Implementation Plan

1. Create `UnifiedInterface.tsx` with tab switching logic
2. Extract and adapt `ApiPanel.tsx` from ModApi
3. Extract and adapt `AppPanel.tsx` from ModApp
4. Extract and adapt `CodePanel.tsx` from ModContent
5. Add tab state management and navigation
6. Integrate with mod context and client
7. Add keyboard shortcuts (Cmd+1/2/3 for tabs)

## Usage Example

```typescript
import UnifiedInterface from '@/components/UnifiedInterface'

<UnifiedInterface
  mod={{
    name: 'claude',
    key: 'user-key',
    schema: { /* API functions */ },
    url_app: 'https://app.example.com',
    content: { 'main.py': 'Qm...' }
  }}
  client={apiClient}
/>
```

## Benefits

- **Single Source of Truth**: One component for all module interactions
- **Better UX**: Seamless switching between API, app, and code
- **Code Reuse**: Leverage existing mod/core/app components
- **Maintainable**: Modular design with clear separation of concerns
- **Familiar**: Developers know this pattern from GitHub, VS Code, etc.
