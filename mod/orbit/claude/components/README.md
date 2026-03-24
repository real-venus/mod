# Unified Interface Components

A comprehensive, three-panel interface inspired by `mod/core/app` that combines API interaction, app preview, and code viewing into a single cohesive experience.

## Overview

The Unified Interface provides:

- **API Panel**: Interactive API function browser with execution capabilities
- **App Panel**: Embedded iframe for app preview
- **Code Panel**: GitHub-style file tree and code viewer

## Architecture

```
components/
├── UnifiedInterface.tsx      # Main container with tab switching
└── panels/
    ├── ApiPanel.tsx          # API interaction (based on ModApi.tsx)
    ├── AppPanel.tsx          # App iframe preview (based on ModApp.tsx)
    └── CodePanel.tsx         # Code viewer (based on ModContent.tsx)
```

## Installation

Simply copy the `components` folder into your project:

```bash
cp -r components /your/project/src/
```

## Usage

### Basic Example

```tsx
import UnifiedInterface from '@/components/UnifiedInterface'

function MyComponent() {
  const moduleData = {
    name: 'my-module',
    key: 'user-key',
    schema: { /* API functions */ },
    url_app: 'https://app.example.com',
    content: { 'main.py': 'Qm...' }
  }

  return (
    <UnifiedInterface
      mod={moduleData}
      client={apiClient}
      defaultTab="api"
    />
  )
}
```

### Props

#### `UnifiedInterface`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `mod` | `ModuleData` | Yes | Module configuration object |
| `client` | `any` | No | API client for making calls and fetching content |
| `defaultTab` | `'api' \| 'app' \| 'code'` | No | Initial tab to display (default: 'api') |

#### `ModuleData` Interface

```typescript
interface ModuleData {
  name: string                      // Module name
  key: string                       // Module key
  schema?: Record<string, any>      // API function schemas
  url_app?: string                  // App URL for iframe
  content?: Record<string, string>  // File paths -> CIDs
  [key: string]: any                // Additional properties
}
```

### API Schema Format

```typescript
schema: {
  functionName: {
    input: {
      paramName: {
        type: 'string' | 'number' | 'bool' | 'object',
        value: 'default value'
      }
    },
    output: { type: 'string' }
  }
}
```

### Example with Full Configuration

```tsx
const mod = {
  name: 'claude',
  key: 'broski',

  // API functions
  schema: {
    generate: {
      input: {
        prompt: { type: 'string', value: '' },
        max_tokens: { type: 'number', value: 100 }
      },
      output: { type: 'string' }
    }
  },

  // App URL
  url_app: 'https://claude.ai',

  // Code files (path -> IPFS CID)
  content: {
    'README.md': 'QmExampleCID1',
    'src/main.py': 'QmExampleCID2',
    'src/api/handlers.py': 'QmExampleCID3'
  }
}

<UnifiedInterface mod={mod} client={client} />
```

## Features by Tab

### API Tab

- **Function Browser**: Searchable list with type signatures
- **Smart Inputs**: Type-aware (bool dropdowns, text inputs)
- **Execution**: Real-time API calls with loading states
- **Results Display**: JSON formatting, image rendering, error handling
- **Copy Support**: Copy results to clipboard

### App Tab

- **iframe Integration**: Seamless app preview
- **Loading States**: Spinner while loading
- **Error Handling**: Graceful failure messages
- **External Link**: Button to open in new tab
- **Sandbox**: Proper iframe security attributes

### Code Tab

- **File Tree**: Hierarchical navigation with expand/collapse
- **Code Viewer**: Syntax detection with line numbers
- **Search**: Filter files by name or path
- **Statistics**: File count, lines, and size
- **Copy**: Copy individual files to clipboard
- **CID Display**: Show IPFS content identifiers

## Styling

The components use CSS variables from the mod design system:

```css
var(--bg-primary)      /* Primary background */
var(--bg-secondary)    /* Secondary background */
var(--bg-surface)      /* Surface background */
var(--bg-input)        /* Input background */
var(--text-primary)    /* Primary text */
var(--text-secondary)  /* Secondary text */
var(--text-tertiary)   /* Tertiary text */
var(--border-color)    /* Border color */
var(--border-strong)   /* Strong border */
var(--font-digital)    /* Digital font family */
```

## Client Integration

The `client` object should implement:

```typescript
interface Client {
  call(path: string, params: Record<string, any>): Promise<any>
}
```

Example:

```typescript
const client = {
  async call(path: string, params: any) {
    const response = await fetch(`/api/${path}`, {
      method: 'POST',
      body: JSON.stringify(params)
    })
    return response.json()
  }
}
```

For the Code tab to fetch file contents, the client should support:

```typescript
await client.call('get', { cid: 'QmExample...' })
```

## Keyboard Shortcuts

The interface displays keyboard shortcuts for quick tab switching:

- `Cmd+1`: API tab
- `Cmd+2`: App tab
- `Cmd+3`: Code tab

(Note: Implementation of shortcuts is left to the parent application)

## Customization

### Hide Tabs

Tabs automatically hide if data is unavailable:

- API tab: Requires `mod.schema` with functions
- App tab: Requires `mod.url_app`
- Code tab: Requires `mod.content`

### Custom Styling

Override CSS variables or add custom styles:

```tsx
<div style={{ '--bg-primary': '#000000' }}>
  <UnifiedInterface mod={mod} client={client} />
</div>
```

## Examples

See `examples/UnifiedInterfaceExample.tsx` for a complete working example.

## Browser Support

- Modern browsers with ES2020+ support
- CSS Grid and Flexbox
- iframe sandbox attributes
- Clipboard API for copy functionality

## Dependencies

Required peer dependencies:

- React 18+
- lucide-react (for icons)
- Next.js (optional, for client components)

## License

MIT

## Credits

Based on the module interface design from `mod/core/app`:
- `ModApi.tsx` - API interaction panel
- `ModApp.tsx` - App preview panel
- `ModContent.tsx` - Code viewer panel
