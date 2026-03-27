# Unified Interface - Quick Start Guide

## ⚡ 30-Second Setup

```bash
# 1. Copy components
cp -r components /your/project/src/
```

```tsx
// 2. Import and use
import { UnifiedInterface } from '@/components'

<UnifiedInterface mod={modData} client={apiClient} />
```

**Done!** You now have a fully functional API + App + Code interface.

---

## 📋 Minimal Example

```tsx
import { UnifiedInterface } from '@/components'

function MyPage() {
  const mod = {
    name: 'my-module',
    key: 'my-key',
    schema: {
      greet: {
        input: { name: { type: 'string', value: '' } },
        output: { type: 'string' }
      }
    }
  }

  const client = {
    async call(path, params) {
      const res = await fetch(`/api/${path}`, {
        method: 'POST',
        body: JSON.stringify(params)
      })
      return res.json()
    }
  }

  return <UnifiedInterface mod={mod} client={client} />
}
```

---

## 📦 What's Included

### 4 Components
- **UnifiedInterface.tsx** - Main container
- **ApiPanel.tsx** - API interaction
- **AppPanel.tsx** - App preview
- **CodePanel.tsx** - Code viewer

### 5 Docs
- **README.md** - Full API reference
- **INTEGRATION_GUIDE.md** - How to integrate
- **COMPONENT_STRUCTURE.md** - Architecture diagrams
- **VISUAL_SHOWCASE.md** - UI examples
- **QUICK_START.md** - This file

### 1 Example
- **UnifiedInterfaceExample.tsx** - Working demo

---

## 🎯 Required Props

```typescript
<UnifiedInterface
  mod={{
    name: string           // Required
    key: string            // Required
    schema?: {...}         // For API tab
    url_app?: string       // For App tab
    content?: {...}        // For Code tab
  }}
  client={apiClient}       // Optional but needed for API calls
  defaultTab="api"         // Optional: 'api' | 'app' | 'code'
/>
```

---

## 🔌 Client Interface

Your client needs just one method:

```typescript
interface Client {
  call(path: string, params: any): Promise<any>
}
```

Example:

```typescript
const client = {
  async call(path, params) {
    // Your API implementation
    return fetch(`/api/${path}`, {
      method: 'POST',
      body: JSON.stringify(params)
    }).then(r => r.json())
  }
}
```

---

## 🎨 Required CSS Variables

Add to your global styles:

```css
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
```

---

## 📊 Complete Example with All Tabs

```tsx
const fullModuleData = {
  name: 'claude',
  key: 'broski',

  // API Tab - Function definitions
  schema: {
    generate: {
      input: {
        prompt: { type: 'string', value: '' },
        max_tokens: { type: 'number', value: 100 }
      },
      output: { type: 'string' }
    },
    analyze: {
      input: {
        text: { type: 'string', value: '' }
      },
      output: { type: 'object' }
    }
  },

  // App Tab - Application URL
  url_app: 'https://claude.ai',

  // Code Tab - File tree (path -> IPFS CID)
  content: {
    'README.md': 'QmExampleCID1',
    'src/main.py': 'QmExampleCID2',
    'src/api/handlers.py': 'QmExampleCID3',
    'tests/test_main.py': 'QmExampleCID4'
  }
}

<UnifiedInterface mod={fullModuleData} client={client} />
```

---

## 🚀 Integration Patterns

### Pattern 1: Next.js Page

```tsx
// app/modules/[name]/page.tsx
"use client"
import { UnifiedInterface } from '@/components'

export default function ModulePage({ params }) {
  // Fetch your module data
  const mod = await fetchModule(params.name)

  return <UnifiedInterface mod={mod} client={client} />
}
```

### Pattern 2: Modal/Dialog

```tsx
import { Dialog } from '@/components/ui/dialog'
import { UnifiedInterface } from '@/components'

function QuickView({ mod }) {
  return (
    <Dialog>
      <UnifiedInterface mod={mod} client={client} />
    </Dialog>
  )
}
```

### Pattern 3: Dashboard Widget

```tsx
function Dashboard() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <MetricsPanel />
      <UnifiedInterface mod={activeMod} client={client} />
    </div>
  )
}
```

---

## ⚙️ Common Configurations

### API Only

```tsx
const apiOnly = {
  name: 'api-module',
  key: 'user',
  schema: { /* functions */ }
}
// Shows only API tab
```

### App Only

```tsx
const appOnly = {
  name: 'app-module',
  key: 'user',
  url_app: 'https://example.com'
}
// Shows only App tab
```

### Code Only

```tsx
const codeOnly = {
  name: 'code-module',
  key: 'user',
  content: { /* files */ }
}
// Shows only Code tab
```

---

## 🎛️ Customization

### Change Default Tab

```tsx
<UnifiedInterface defaultTab="code" {...props} />
```

### Custom Styling

```tsx
<div style={{ '--border-strong': '#ff00ff' }}>
  <UnifiedInterface {...props} />
</div>
```

### Authenticated Client

```tsx
const authClient = {
  async call(path, params) {
    return fetch(`/api/${path}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      method: 'POST',
      body: JSON.stringify(params)
    }).then(r => r.json())
  }
}

<UnifiedInterface client={authClient} {...props} />
```

---

## 🐛 Troubleshooting

### Tabs Not Showing?
**Check:** Does mod have required data?
- API tab needs `schema`
- App tab needs `url_app`
- Code tab needs `content`

### API Calls Failing?
**Check:** Client implementation
```tsx
// Must support this pattern:
await client.call('module-name/function-name', { params })
```

### Styles Look Wrong?
**Check:** CSS variables defined in global.css
```css
:root { --bg-primary: #000; ... }
```

### iframe Not Loading?
**Check:**
- URL is valid and accessible
- CORS allows iframe embedding
- CSP headers permit iframes

---

## 📚 Next Steps

1. ✅ **Working?** Check out `INTEGRATION_GUIDE.md` for advanced usage
2. 🎨 **Customizing?** See `VISUAL_SHOWCASE.md` for styling examples
3. 🏗️ **Extending?** Review `COMPONENT_STRUCTURE.md` for architecture
4. 📖 **Full Docs?** Read `components/README.md` for complete API reference

---

## 💡 Tips

- **Tab Visibility**: Tabs auto-hide if no data available
- **Keyboard Shortcuts**: Hint shown in footer (Cmd+1/2/3)
- **Search**: Both API and Code panels have search
- **Copy**: Click copy icons to copy results/code
- **Loading**: Content loads on-demand for performance
- **Mobile**: Responsive design works on all screen sizes

---

## 🔗 File Structure

```
your-project/
└── src/
    └── components/
        ├── UnifiedInterface.tsx
        ├── index.ts
        └── panels/
            ├── ApiPanel.tsx
            ├── AppPanel.tsx
            └── CodePanel.tsx
```

---

## ✨ Features at a Glance

| Feature | API Tab | App Tab | Code Tab |
|---------|---------|---------|----------|
| Search | ✅ Functions | ❌ | ✅ Files |
| Execute | ✅ Live calls | ❌ | ❌ |
| Copy | ✅ Results | ❌ | ✅ Files |
| Preview | ❌ | ✅ iframe | ✅ Code |
| Interactive | ✅ Forms | ✅ App | ✅ Tree |

---

## 🎓 Learning Path

1. **Quick Start** (this file) → Get it running
2. **Example** (`examples/UnifiedInterfaceExample.tsx`) → See it work
3. **Integration** (`INTEGRATION_GUIDE.md`) → Use in your app
4. **Architecture** (`COMPONENT_STRUCTURE.md`) → Understand it
5. **Reference** (`components/README.md`) → Master it

---

## 📞 Support

- 📖 Documentation in `components/README.md`
- 💡 Examples in `examples/`
- 🏗️ Architecture in `COMPONENT_STRUCTURE.md`
- 🎨 UI Reference in `VISUAL_SHOWCASE.md`

---

**Ready to code?** Start with the minimal example above! 🚀
