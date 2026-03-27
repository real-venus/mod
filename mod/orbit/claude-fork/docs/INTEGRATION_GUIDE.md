# Unified Interface Integration Guide

Complete guide to integrating the Unified Interface into your mod-based application.

## Quick Start

### 1. Copy Components

```bash
# From mod/orbit/claude/
cp -r components /your/project/src/
```

### 2. Create a Page

```tsx
// app/modules/[name]/page.tsx
"use client";

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import UnifiedInterface from '@/components/UnifiedInterface'
import { userContext } from '@/context'

export default function ModulePage() {
  const params = useParams()
  const { client } = userContext()
  const [mod, setMod] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchModule() {
      const data = await client.call('mod', {
        mod: params.name,
        expand: true,
        schema: true
      })
      setMod(data)
      setLoading(false)
    }
    fetchModule()
  }, [params.name, client])

  if (loading) return <div>Loading...</div>
  if (!mod) return <div>Module not found</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-6">{mod.name}</h1>
      <UnifiedInterface mod={mod} client={client} />
    </div>
  )
}
```

### 3. Use with Existing Mod Data

If you already have mod data from the mod/core/app structure:

```tsx
import UnifiedInterface from '@/components/UnifiedInterface'

// In your component
<UnifiedInterface
  mod={existingModData}
  client={existingClient}
  defaultTab="api"
/>
```

## Integration Patterns

### Pattern 1: Standalone Page

Use as the main content of a dedicated module page.

```tsx
// app/mod/[mod]/[key]/page.tsx
import ModulePage from './ModulePage'

export default function Page() {
  return <ModulePage />
}
```

### Pattern 2: Modal/Overlay

Display in a modal for quick interactions.

```tsx
import { Dialog } from '@/components/ui/dialog'
import UnifiedInterface from '@/components/UnifiedInterface'

function ModuleModal({ mod, open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <UnifiedInterface mod={mod} client={client} />
    </Dialog>
  )
}
```

### Pattern 3: Embedded in Dashboard

Include as part of a larger dashboard.

```tsx
function Dashboard() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <MetricsPanel />
      </div>
      <div>
        <UnifiedInterface mod={selectedMod} client={client} />
      </div>
    </div>
  )
}
```

## Data Flow

### Fetching Module Data

```typescript
// 1. Fetch module with schema
const mod = await client.call('mod', {
  mod: 'module-name',
  key: 'user-key',
  expand: true,   // Get full details
  schema: true    // Include API schema
})

// 2. Pass to interface
<UnifiedInterface mod={mod} client={client} />
```

### Client Implementation

Your client should support these operations:

```typescript
interface ModClient {
  // Call API functions
  call(path: string, params: Record<string, any>): Promise<any>

  // Fetch file content by CID (for Code tab)
  call('get', { cid: string }): Promise<string>

  // Fetch module data
  call('mod', { mod: string, key: string, ... }): Promise<ModuleData>
}
```

Example implementation:

```typescript
class ModClient {
  constructor(private baseUrl: string) {}

  async call(path: string, params: any) {
    const response = await fetch(`${this.baseUrl}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
    if (!response.ok) throw new Error(`API error: ${response.statusText}`)
    return response.json()
  }
}
```

## Tab Configuration

### Show Only Specific Tabs

The interface automatically shows/hides tabs based on available data:

```typescript
// Only API tab (no app or code)
const apiOnlyMod = {
  name: 'api-module',
  key: 'user',
  schema: { /* functions */ }
  // No url_app or content
}

// Only App tab (no API or code)
const appOnlyMod = {
  name: 'app-module',
  key: 'user',
  url_app: 'https://example.com'
  // No schema or content
}

// All tabs
const fullMod = {
  name: 'full-module',
  key: 'user',
  schema: { /* functions */ },
  url_app: 'https://example.com',
  content: { /* files */ }
}
```

### Default Tab Selection

```tsx
// Default to API tab
<UnifiedInterface mod={mod} client={client} defaultTab="api" />

// Default to App tab
<UnifiedInterface mod={mod} client={client} defaultTab="app" />

// Default to Code tab
<UnifiedInterface mod={mod} client={client} defaultTab="code" />
```

## Styling Integration

### Using Mod Design System

The components use CSS variables from mod's design system. Ensure these are defined:

```css
/* globals.css or theme.css */
:root {
  --bg-primary: #000000;
  --bg-secondary: #0a0a0a;
  --bg-surface: #141414;
  --bg-input: #1a1a1a;
  --text-primary: #ffffff;
  --text-secondary: #b0b0b0;
  --text-tertiary: #707070;
  --border-color: #333333;
  --border-strong: #00ff00;
  --font-digital: 'JetBrains Mono', monospace;
  --scrollbar-thumb: #333333;
}

/* Light mode */
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-surface: #eeeeee;
  --bg-input: #e8e8e8;
  --text-primary: #000000;
  --text-secondary: #404040;
  --text-tertiary: #808080;
  --border-color: #cccccc;
  --border-strong: #00aa00;
}
```

### Custom Styling

Override specific components:

```tsx
<div className="custom-interface">
  <UnifiedInterface mod={mod} client={client} />
</div>

<style jsx>{`
  .custom-interface :global(.font-mono) {
    font-family: 'Custom Mono', monospace;
  }
`}</style>
```

## Advanced Usage

### With Authentication

```tsx
import { useAuth } from '@/hooks/useAuth'

function AuthenticatedInterface() {
  const { user, token } = useAuth()

  const authenticatedClient = useMemo(() => ({
    async call(path: string, params: any) {
      const response = await fetch(`/api/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(params)
      })
      return response.json()
    }
  }), [token])

  return <UnifiedInterface mod={mod} client={authenticatedClient} />
}
```

### With Error Boundaries

```tsx
import { ErrorBoundary } from 'react-error-boundary'

function SafeInterface() {
  return (
    <ErrorBoundary fallback={<div>Error loading interface</div>}>
      <UnifiedInterface mod={mod} client={client} />
    </ErrorBoundary>
  )
}
```

### With Loading States

```tsx
function InterfaceWithLoading() {
  const [mod, setMod] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMod().then(setMod).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-12 bg-gray-200 mb-4" />
        <div className="h-96 bg-gray-200" />
      </div>
    )
  }

  return <UnifiedInterface mod={mod} client={client} />
}
```

## Migration from Existing Mod Pages

If you're migrating from the existing `ModulePage.tsx`:

### Before (ModulePage.tsx)

```tsx
<div>
  {activeTab === 'api' && <ModApi mod={mod} />}
  {activeTab === 'app' && <ModApp mod={mod} />}
  {activeTab === 'content' && <ModContent mod={mod} />}
</div>
```

### After (UnifiedInterface)

```tsx
<UnifiedInterface mod={mod} client={client} defaultTab="api" />
```

### Key Differences

1. **Unified Component**: Single component instead of three separate ones
2. **Automatic Tab Management**: Tabs show/hide based on data availability
3. **Consistent Styling**: All panels use the same design system
4. **Better Integration**: Shared state and navigation between panels

## Troubleshooting

### Tabs Not Showing

**Problem**: Some tabs are missing

**Solution**: Ensure mod data has the required fields:
- API tab: `mod.schema` with functions
- App tab: `mod.url_app`
- Code tab: `mod.content` with files

### API Calls Failing

**Problem**: API execution returns errors

**Solution**: Check client implementation:
```typescript
// Client must support calling mod functions
await client.call('mod-name/function-name', { params })
```

### Code Content Not Loading

**Problem**: Files show "Loading..." indefinitely

**Solution**: Client must support CID fetching:
```typescript
// Must implement get function
await client.call('get', { cid: 'QmExample...' })
```

### Styling Issues

**Problem**: Components look unstyled

**Solution**: Ensure CSS variables are defined in your global styles

### iframe Not Loading

**Problem**: App tab shows blank

**Solution**: Check CORS and iframe policies:
- Verify `url_app` is accessible
- Check CSP headers allow iframe embedding
- Ensure target site allows iframe embedding

## Performance Optimization

### Lazy Load Panels

```tsx
import dynamic from 'next/dynamic'

const UnifiedInterface = dynamic(
  () => import('@/components/UnifiedInterface'),
  { ssr: false, loading: () => <LoadingSpinner /> }
)
```

### Memoize Client

```tsx
const client = useMemo(() => ({
  async call(path: string, params: any) {
    // Implementation
  }
}), [dependencies])
```

### Debounce Search

Already implemented in panels - search inputs are debounced for performance.

## Examples

See the `examples/` directory for:
- `UnifiedInterfaceExample.tsx` - Complete working example
- More examples coming soon

## Support

For issues or questions:
- Check the README in `components/README.md`
- Review examples in `examples/`
- Open an issue in the mod repository
