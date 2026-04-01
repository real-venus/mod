# Navigation Configuration

This directory contains the configuration for the sidebar navigation system.

## Quick Start: Adding Navigation Items

**The easiest way to add modules is to edit `sidebar.json`** - no TypeScript knowledge required!

### Method 1: Edit sidebar.json (Recommended)

Edit `src/config/sidebar.json` to add navigation items:

#### Adding a Direct Route (Page exists in src/app/)

If you have a page at `src/app/mypage/page.tsx`:

```json
{
  "navigation": [
    {
      "href": "/mypage",
      "label": "MY PAGE",
      "color": "#ff6b6b",
      "type": "direct"
    }
  ]
}
```

**Don't forget to also add `"mypage"` to the `availableRoutes` array!**

#### Adding Module Routes (Dynamically resolve to module pages)

For quick addition of multiple modules, use the `additionalModules` array:

```json
{
  "additionalModules": ["agent", "ipfs", "cache", "skill"]
}
```

These modules will automatically:
1. Check if `src/app/{module}/page.tsx` exists
2. If yes → navigate to that page
3. If no → navigate to `/mod/explore?search={module}` or `/mod/{module}/{userAddress}`

Colors will be auto-generated consistently based on the module name.

#### Adding Module Routes with Custom Configuration

For more control over labels and colors:

```json
{
  "navigation": [
    {
      "href": "/agent",
      "label": "AGENT",
      "color": "#4ecdc4",
      "type": "module",
      "moduleName": "agent"
    }
  ]
}
```

### Method 2: Edit TypeScript Files

For advanced customization, you can edit `navigation.ts` or `dynamicNavigation.ts`.

## Complete Example

Here's a full `sidebar.json` with new modules added:

```json
{
  "navigation": [
    {
      "href": "/mod/explore",
      "label": "MODS",
      "color": "#10b981",
      "type": "direct"
    },
    {
      "href": "/quests",
      "label": "QUESTS",
      "color": "#0bf58c",
      "type": "direct"
    },
    {
      "href": "/agent",
      "label": "AGENT",
      "color": "#4ecdc4",
      "type": "module"
    },
    {
      "href": "/chat",
      "label": "CHAT",
      "color": "#8b5cf6",
      "type": "direct"
    }
  ],
  "additionalModules": ["ipfs", "cache", "skill", "bridge"],
  "availableRoutes": [
    "mod",
    "quests",
    "chat",
    "agent",
    "treasury",
    "contracts",
    "transactions",
    "docs",
    "safe"
  ]
}
```

## How It Works

### Direct Routes (`type: "direct"`)
- Points to a page that exists in `src/app/{route}/page.tsx`
- Always navigates to the exact href specified
- Example: `/chat` → `src/app/chat/page.tsx`

### Module Routes (`type: "module"`)
- Smart routing that adapts based on what exists
- Checks if `src/app/{module}/page.tsx` exists first
- If page exists → navigates to that page
- If no page → navigates to module marketplace
  - With user logged in: `/mod/{module}/{userAddress}`
  - Without user: `/mod/explore?search={module}`

### Additional Modules Array
- Simplest way to add multiple modules at once
- Automatically creates module-type navigation items
- Colors are auto-generated for consistency
- Perfect for adding orbit ecosystem modules

## Color Palette

Colors currently in use:

| Color | Hex | Used By |
|-------|-----|---------|
| Emerald | `#10b981` | MODS |
| Lime | `#0bf58c` | QUESTS |
| Purple | `#a855f7` | TREASURY |
| Amber | `#f59e0b` | CONTRACTS, SAFE |
| Blue | `#3b82f6` | TRANSACTIONS |
| Violet | `#a78bfa` | DOCS |
| Deep Purple | `#8b5cf6` | CHAT |

Feel free to use any hex color code! Auto-generated colors include:
`#10b981`, `#3b82f6`, `#8b5cf6`, `#f59e0b`, `#ef4444`, `#06b6d4`, `#ec4899`, `#84cc16`, `#f97316`, `#a855f7`, `#14b8a6`, `#6366f1`

## Available Orbit Modules

Some modules from `~/mod/orbit/` you might want to add:

- `agent` - AI agent functionality
- `ipfs` - IPFS storage
- `cache` - Caching utilities
- `skill` - Skills system
- `bridge` - Cross-chain bridge
- `web` - Web utilities
- `filecoin` - Filecoin integration
- `claude` - Claude integration
- `dev` - Development tools
- `ctx` - Context management
- `model` - AI models

## Configuration Structure

```typescript
interface NavItem {
  href: string          // URL path (e.g., '/chat')
  label: string         // Display text (e.g., 'CHAT')
  color: string         // Hex color (e.g., '#8b5cf6')
  type: 'direct' | 'module'  // Routing behavior
  moduleName?: string   // Optional: override module name
}
```

## After Making Changes

After editing `sidebar.json`:
1. Save the file
2. Restart your dev server (`npm run dev` or similar)
3. The sidebar will automatically update with your new navigation items!
