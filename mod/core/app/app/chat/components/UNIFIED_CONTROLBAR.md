# UnifiedControlBar - IBM ASCII Terminal Style

## Overview
Merged the function control bar and tab navigation into a single unified component with IBM-style ASCII aesthetics.

## Features

### 🎨 IBM ASCII Terminal Vibes
- Box drawing characters (┌─┐│└─┘) as decorative corner elements
- Monospace IBM Plex Mono font throughout
- Sharp geometric borders with gradient effects
- Terminal-inspired color scheme (green, cyan, purple, orange accents)
- Dark background with subtle gradients

### ⚡ Function Control
- Function selector with dropdown
- Send/Stop button with IBM terminal styling
- Border highlighting (yellow for SEND, red for STOP)
- Corner bracket decorations on active states

### 📑 Tab Navigation
- 4 tabs: CHAT, PARAMS, CODE, OUTPUTS
- Color-coded tabs (green, cyan, purple, orange)
- ASCII corner brackets on active tab
- Uppercase tracking for terminal aesthetic
- Pending count badge on OUTPUTS tab

## Component Structure

```
┌─ UnifiedControlBar ─┐
│                      │
│ ┌─ Function Selector + Send Button ─┐
│ │  [Dropdown]          [⚡ SEND]     │
│ └──────────────────────────────────┘
│                      │
│ ┌─ Tab Navigation ─┐ │
│ │ 💬 CHAT │ 📋 PARAMS │ 💻 CODE │ 📤 OUTPUTS │
│ └───────────────────┘ │
└──────────────────────┘
```

## Usage

```tsx
<UnifiedControlBar
  selectedModules={modules}
  selectedFunction={func}
  setSelectedFunction={setFunc}
  fetchedSchemas={schemas}
  isLoading={loading}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
  canSubmit={canSubmit}
  activeTab={tab}
  setActiveTab={setTab}
  pendingCount={0}
/>
```

## Design Principles

1. **Monospace Everything** - IBM Plex Mono for authentic terminal feel
2. **ASCII Decorations** - Box drawing chars for borders and corners
3. **Color Coding** - Each tab/action has distinct color identity
4. **High Contrast** - Dark backgrounds with bright accent colors
5. **Wide Tracking** - Letter spacing for that retro computer aesthetic

## Color Palette

- **Green** (#10B981) - Chat/Terminal input
- **Cyan** (#06B6D4) - Params/Configuration
- **Purple** (#A855F7) - Code/Development
- **Orange** (#F97316) - Outputs/Results
- **Yellow** (#EAB308) - Send action
- **Red** (#DC2626) - Stop/Cancel action

## Migration Notes

Replaces:
- `TabBar.tsx` - Tab navigation
- `FunctionControlBar.tsx` - Function selector + Send button (still exists but not used in main Chat)

Benefits:
- Single unified control interface
- Consistent IBM terminal aesthetic
- Reduced component complexity
- Better visual cohesion
