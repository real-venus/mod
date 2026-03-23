# ⚡ Quick Reference: Collapsible Asks & Themes

## 🚀 TL;DR

Two new features:
1. **Collapsible Asks** - Show/hide questions under tasks
2. **Theme Toggle** - Switch between dark/light modes

## 🎯 Quick Actions

| Action | How |
|--------|-----|
| Toggle theme | Click **☀/🌙** in header |
| Expand asks | Click **▶ N Asks** on task |
| Collapse asks | Click **▼ N Asks** again |
| View ask details | Expand to see Q, A, timestamp |

## 📊 Data Structure

```typescript
// Add to any job
{
  asks: [
    {
      question: "Your question here?",
      answer: "Optional answer",
      timestamp: 1710234567
    }
  ]
}
```

## 🎨 Theme Comparison

| Feature | Dark Mode | Light Mode |
|---------|-----------|------------|
| Background | `#0a0a0a` | `#f5f5f0` |
| Text | `#33ff33` | `#1a3d0a` |
| Icon | 🌙 | ☀ |
| Best for | Night, low light | Day, bright rooms |

## 🔧 Quick Setup

### 1. Frontend (Already Done ✅)
```bash
cd app
npm run dev
```

### 2. Test with Mock Data
```typescript
// In fetchJobs() function
const mockAsk = {
  question: "Test question?",
  answer: "Test answer",
  timestamp: Date.now() / 1000 - 300
};

job.asks = [mockAsk];
```

### 3. Backend (Optional - Future Work)
```rust
// In server/src/jobs.rs
pub struct ClaudeJob {
    // ... existing fields
    pub asks: Option<Vec<Ask>>,
}
```

## 💡 Tips & Tricks

1. **Theme Preference**: Will auto-reset on refresh (localStorage coming soon)
2. **Multiple Asks**: Can have unlimited asks per job
3. **Unanswered Asks**: Leave `answer` field empty
4. **Timestamps**: Automatically formats to "Xm ago" / "Xh ago"
5. **Event Bubbling**: Clicking asks won't select the task

## 🎬 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘+Enter` | Submit new task |
| *(Future)* `⌘+T` | Toggle theme |
| *(Future)* `⌘+K` | Focus search |

## 📱 Responsive Behavior

- **Desktop**: Full 50/50 split panel
- **Tablet**: Adjusts panel sizes
- **Mobile**: Stack panels vertically (future)

## 🐛 Known Issues

| Issue | Status | Workaround |
|-------|--------|------------|
| Theme not saved | Known | Re-toggle on refresh |
| Asks not persisted | Known | Backend WIP |
| No ask editing | Known | Coming soon |

## 🔮 Coming Soon

- [ ] localStorage theme persistence
- [ ] Backend API for asks
- [ ] Real-time ask streaming
- [ ] Filter by unanswered asks
- [ ] Inline ask editor
- [ ] Ask notifications

## 📚 Documentation

| File | Purpose |
|------|---------|
| `FEATURE_SUMMARY.md` | Executive summary |
| `COLLAPSIBLE_ASKS_FEATURE.md` | Detailed guide |
| `VISUAL_GUIDE.md` | Visual diagrams |
| `IMPROVEMENTS.md` | All enhancements |
| `QUICK_REFERENCE.md` | This file |

## 🎯 Code Snippets

### Toggle Theme
```typescript
<button onClick={() => setIsDarkMode(!isDarkMode)}>
  {isDarkMode ? "☀" : "🌙"}
</button>
```

### Toggle Asks
```typescript
const toggleAsks = (jobId: string, e: React.MouseEvent) => {
  e.stopPropagation();
  setExpandedAsks((prev) => {
    const next = new Set(prev);
    next.has(jobId) ? next.delete(jobId) : next.add(jobId);
    return next;
  });
};
```

### Render Asks
```tsx
{job.asks && job.asks.length > 0 && (
  <button onClick={(e) => toggleAsks(job.id, e)}>
    <span style={{
      transform: expandedAsks.has(job.id)
        ? "rotate(90deg)"
        : "rotate(0deg)"
    }}>▶</span>
    {job.asks.length} Asks
  </button>
)}
```

## 🧪 Testing Checklist

- [ ] Asks expand/collapse smoothly
- [ ] Theme toggle works
- [ ] Colors change correctly
- [ ] Timestamps format properly
- [ ] Multiple asks display
- [ ] Unanswered asks show
- [ ] Arrow rotates on toggle
- [ ] Event bubbling prevented
- [ ] Works with search/filter
- [ ] Responsive on mobile

## 🎨 Color Codes

### Dark Mode
```
Green:  #33ff33  rgb(51,255,51)
Amber:  #ffb000  rgb(255,176,0)
Blue:   #00aaff  rgb(0,170,255)
Red:    #ff3333  rgb(255,51,51)
BG:     #0a0a0a  rgb(10,10,10)
```

### Light Mode
```
Green:  #1a3d0a  rgb(26,61,10)
Amber:  #996600  rgb(153,102,0)
Blue:   #004d99  rgb(0,77,153)
Red:    #b30000  rgb(179,0,0)
BG:     #f5f5f0  rgb(245,245,240)
```

## 📞 Support

- Issues: [GitHub Issues](https://github.com/your-repo/issues)
- Docs: This directory
- Questions: Open a discussion

---

**Bismillah** ░ Quick Ref ░ Claude Jobs v1.0

*Get productive in 60 seconds ⚡*
