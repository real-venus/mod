# ✨ New Features: Collapsible Asks & Light/Dark Mode

## 🎯 Summary

Two major UI enhancements have been added to Claude Jobs:

1. **Collapsible Asks Section** - Display questions and answers under tasks
2. **Light/Dark Mode Toggle** - Switch between terminal and light themes

## 🚀 Quick Usage

### Collapsible Asks

Tasks now support an optional `asks` array to display questions/clarifications:

```typescript
// In your job data
{
  asks: [
    {
      question: "Should I use TypeScript?",
      answer: "Yes, with strict mode",
      timestamp: 1710234567
    }
  ]
}
```

**UI Interaction:**
- Click **"▶ N Asks"** to expand
- Click again to collapse
- Shows relative timestamps (e.g., "2m ago")
- Maintains pixel art aesthetic

### Theme Toggle

Click the **☀/🌙** button in the header to switch between:

| Dark Mode | Light Mode |
|-----------|------------|
| CRT green terminal | Clean light interface |
| `#33ff33` on `#0a0a0a` | `#1a3d0a` on `#f5f5f0` |
| Classic retro feel | Modern readable design |

## 📦 What Changed

### Files Modified
- `app/src/app/page.tsx` - Main component
- `app/src/app/globals.css` - Theme variables
- `IMPROVEMENTS.md` - Documentation update
- `COLLAPSIBLE_ASKS_FEATURE.md` - Feature guide

### New State
```typescript
const [expandedAsks, setExpandedAsks] = useState<Set<string>>(new Set());
const [isDarkMode, setIsDarkMode] = useState(true);
```

### New Functions
```typescript
const toggleAsks = (jobId: string, e: React.MouseEvent) => { ... }
```

### Enhanced Interface
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

## 🎨 Design Highlights

### Asks Display
- **Blue color scheme** (`#00aaff` / `#004d99`) to differentiate from task status
- **Smooth animations** - 200ms rotation for expand/collapse arrow
- **Proper spacing** - Border-left visual hierarchy
- **Event handling** - Stops propagation to prevent task selection

### Theme System
- **CSS custom properties** for easy theming
- **Document-level theme** attribute (`data-theme="light"`)
- **Consistent colors** across all UI elements
- **Readable contrast** in both modes

## 📊 Color Palette

### Dark Mode (Default)
```css
--crt-green: #33ff33      /* Primary text */
--crt-amber: #ffb000      /* Accents */
--crt-blue: #00aaff       /* Asks */
--crt-red: #ff3333        /* Errors */
--crt-dark: #0a0a0a       /* Background */
```

### Light Mode
```css
--crt-green: #1a3d0a      /* Primary text */
--crt-amber: #996600      /* Accents */
--crt-blue: #004d99       /* Asks */
--crt-red: #b30000        /* Errors */
--crt-dark: #f5f5f0       /* Background */
```

## 🔧 Technical Implementation

### Theme Application
```typescript
useEffect(() => {
  if (isDarkMode) {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}, [isDarkMode]);
```

### Asks Toggle
```typescript
const toggleAsks = (jobId: string, e: React.MouseEvent) => {
  e.stopPropagation(); // Prevent task selection
  setExpandedAsks((prev) => {
    const next = new Set(prev);
    if (next.has(jobId)) {
      next.delete(jobId);
    } else {
      next.add(jobId);
    }
    return next;
  });
};
```

### Conditional Rendering
```tsx
{job.asks && job.asks.length > 0 && (
  <div className="mt-2 mb-2">
    <button onClick={(e) => toggleAsks(job.id, e)}>
      <span style={{
        transform: expandedAsks.has(job.id)
          ? "rotate(90deg)"
          : "rotate(0deg)"
      }}>▶</span>
      {job.asks.length} {job.asks.length === 1 ? "Ask" : "Asks"}
    </button>
    {expandedAsks.has(job.id) && (
      <div>
        {/* Asks content */}
      </div>
    )}
  </div>
)}
```

## 🎯 User Benefits

1. **Better Context** - See clarifications and decisions made during task execution
2. **Cleaner UI** - Asks are collapsed by default, keeping the interface tidy
3. **Flexible Viewing** - Choose the theme that works best for your environment
4. **Improved Readability** - Light mode for daytime work, dark mode for night
5. **Progressive Disclosure** - Expand only what you need to see

## 📈 Next Steps

### Backend Integration
- Add `asks` column to SQLite database
- Create API endpoints: `POST /jobs/:id/asks`, `GET /jobs/:id/asks`
- Stream asks via SSE during job execution
- Store ask history and edits

### Enhanced Features
- Persist theme to localStorage
- Filter jobs by unanswered asks
- Inline ask answering in UI
- Export asks to markdown
- Search across all asks
- Ask notifications/badges

### UX Improvements
- Keyboard shortcuts for theme toggle
- Smooth theme transition animation
- Ask status indicators (answered/pending)
- Rich text formatting in asks
- Attachments/code snippets in asks

## 🐛 Current Limitations

- Asks only exist in frontend state (no backend persistence)
- Theme preference not saved (resets on refresh)
- No real-time ask updates via SSE
- No ask editing or deletion UI
- Limited to text-only asks (no formatting)

## 🧪 Testing

To test with mock data, add asks to any job:

```typescript
const mockJob: Job = {
  id: "test-123",
  prompt: "Implement authentication",
  model: "sonnet",
  work_dir: "~/project",
  status: "completed",
  output: "Done!",
  error: null,
  pid: null,
  created_at: Date.now() / 1000 - 600,
  updated_at: Date.now() / 1000 - 300,
  asks: [
    {
      question: "Which auth method should I use?",
      answer: "JWT with refresh tokens",
      timestamp: Date.now() / 1000 - 500
    },
    {
      question: "Should I add 2FA?",
      answer: "Yes, optional TOTP",
      timestamp: Date.now() / 1000 - 400
    }
  ]
};
```

## 📚 Documentation

- **Full Feature Guide**: `COLLAPSIBLE_ASKS_FEATURE.md`
- **All Improvements**: `IMPROVEMENTS.md`
- **This Summary**: `FEATURE_SUMMARY.md`

---

**Bismillah** ░ Claude Jobs v1.0 ░ Now with Asks & Themes

*Made with ❤️ for better AI task management*
