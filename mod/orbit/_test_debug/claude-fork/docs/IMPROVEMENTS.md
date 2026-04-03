# Claude Jobs UI Improvements

## 🎨 UX Enhancements

### 1. **Searchable Tasks** 🔍
- Added a search input at the top of the task list
- Filter tasks by:
  - Prompt text
  - Job ID
  - Model (haiku/sonnet/opus)
  - Status (running/pending/completed/failed/cancelled)
  - Working directory path
- Live filtering with visual feedback
- "Clear All" button to reset filters

### 2. **Status Filter Buttons**
- Quick filter buttons for each status type
- Shows count of tasks per status
- Click to toggle filter on/off
- Visual highlight for active filters
- Only shows buttons for statuses that have tasks

### 3. **Larger Input Areas** 📝
- **Task description textarea**: Increased from 96px to 128px height
- **Left panel**: Expanded from 440px to 50% of screen width
- Better spacing and padding throughout
- Larger, more prominent "Execute Task" button
- Improved label styling and organization

### 4. **Better Visual Design** ✨

#### Input Form
- Structured labels for each field
- Better visual hierarchy
- Full-width submit button with icon
- Improved placeholder text
- Better layout with flex columns

#### Task List
- Larger job cards with better spacing
- Shows working directory on each task
- Better status icons and labels (11px vs 10px)
- Enhanced hover effects with border highlighting
- Smooth transitions (150ms)
- Box shadow on selected tasks
- Truncated prompts at 90 chars instead of 70

#### Search & Filters
- Dedicated search section with icon
- Live "FILTERING" indicator when search is active
- Status filter chips with icons and counts
- Clear visual feedback for active filters

### 5. **Improved Typography & Colors**
- Better text shadows for readability
- Enhanced CRT glow effects
- Improved color contrast
- Better letter spacing
- Consistent font sizing hierarchy

### 6. **Enhanced Interactions**
- Smooth hover states on tasks
- Border color preview on hover
- Better focus indicators
- Keyboard shortcut badge (⌘+Enter)
- Loading states with animations

### 7. **Empty States**
- Improved "No tasks" message
- Dedicated "No search results" state
- Quick clear search button

## 🚀 How to Use

### Search Tasks
1. Type in the search box to filter tasks instantly
2. Search works across prompt, ID, model, status, and directory
3. Click "CLEAR ALL ✕" to reset

### Filter by Status
1. Click any status chip (e.g., "▶ RUNNING (2)")
2. Click again to clear the filter
3. Combine with search for precise filtering

### Keyboard Shortcuts
- `⌘+Enter` / `Ctrl+Enter` - Submit new task from textarea

## 🎯 Technical Changes

### Files Modified
1. `app/src/app/page.tsx` - Main component logic
2. `app/src/app/globals.css` - Enhanced styles

### New State Variables
- `searchQuery` - Current search text
- `statusFilter` - Active status filter

### New Features
- `filteredJobs` - Computed filtered job list
- Status filter buttons with counts
- Enhanced hover/focus states

## 📊 Before vs After

| Feature | Before | After |
|---------|--------|-------|
| Left Panel Width | 440px | 50% screen |
| Textarea Height | 96px | 128px |
| Task Card Spacing | 12px | 14px |
| Search | ❌ | ✅ |
| Status Filters | ❌ | ✅ |
| Working Dir Display | ❌ | ✅ |
| Hover Effects | Basic | Enhanced |
| Focus Indicators | Basic | Enhanced |

## 🌟 User Experience Improvements

1. **Faster task navigation** - Search and filter to find tasks instantly
2. **Better readability** - Larger text, better spacing, improved contrast
3. **More information** - Working directory shown on each task
4. **Smoother interactions** - Enhanced transitions and hover effects
5. **Professional feel** - Polished UI with attention to detail

---

## 🆕 Collapsible Asks Feature

### Overview
Added support for displaying collapsible "asks" sections under task descriptions, with full light and dark mode support.

### Features

#### 1. Collapsible Asks Section
- Each job can now display a list of asks (questions) with optional answers
- Asks are collapsed by default to keep the UI clean
- Click the arrow icon to expand/collapse the asks section
- Shows the count of asks (e.g., "3 Asks")

#### 2. Ask Data Structure
```typescript
interface Job {
  // ... existing fields
  asks?: Array<{
    question: string;
    answer?: string;
    timestamp?: number;
  }>;
}
```

#### 3. Light/Dark Mode Toggle ☀🌙
- Added theme toggle button in the header (☀/🌙 icon)
- Supports full light and dark mode theming
- All UI elements respect the selected theme:
  - Background colors
  - Text colors
  - Border colors
  - Button styles
  - Output terminal styling

### Visual Design

#### Dark Mode (Default)
- Background: `#0a0a0a`
- Primary color: `#33ff33` (CRT green)
- Asks background: `rgba(0,170,255,0.03)`
- Asks text: Blue tones (`#00aaff`)

#### Light Mode
- Background: `#f5f5f0`
- Primary color: `#2d5016` (Dark green)
- Asks background: `rgba(0,170,255,0.08)`
- Asks text: Blue tones (`#0066cc`)

### Usage Example

To add asks to a job, include them in the job data:

```json
{
  "id": "job-123",
  "prompt": "Implement feature X",
  "model": "sonnet",
  "status": "running",
  "asks": [
    {
      "question": "Should I use TypeScript or JavaScript?",
      "answer": "TypeScript",
      "timestamp": 1679234567
    },
    {
      "question": "Which testing framework?",
      "answer": "Jest",
      "timestamp": 1679234589
    }
  ]
}
```

### UI Interactions

1. **Viewing Asks**: Click the "▶ N Asks" button to expand the asks section
2. **Collapsing Asks**: Click again to collapse
3. **Theme Toggle**: Click the ☀/🌙 button in the header to switch themes
4. **Timestamps**: Relative timestamps are shown (e.g., "2m ago", "5h ago")

### Implementation Details

- State management using React hooks (`expandedAsks` set)
- Smooth rotation animation for the arrow icon (90deg rotation)
- Theme state persisted in component state
- Prevents event bubbling when clicking asks toggle
- Responsive design maintained
- Pixel art aesthetic maintained in both themes

### Future Enhancements

- [ ] Persist theme preference to localStorage
- [ ] Add backend API endpoint to store/retrieve asks
- [ ] Real-time updates for asks via SSE stream
- [ ] Filter jobs by those with unanswered asks
- [ ] Add inline ask answering capability
- [ ] Export asks to markdown/JSON

### Technical Notes

- Compatible with existing job data structure (asks are optional)
- No breaking changes to API
- CSS custom properties used for theming
- Uses existing `timeSince()` helper for timestamps

---

Bismillah ░ Claude Jobs v1.0 ░ Enhanced Edition
