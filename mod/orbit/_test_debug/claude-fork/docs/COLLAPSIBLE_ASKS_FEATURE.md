# Collapsible Asks Feature - Quick Start Guide

## ✨ What's New

This update adds two major features to Claude Jobs:

1. **Collapsible Asks Section** - Display questions and answers under each task
2. **Light/Dark Mode Toggle** - Switch between light and dark themes

## 🚀 Quick Demo

### Running the App

```bash
# Terminal 1 - Start the backend server
cd server && cargo run

# Terminal 2 - Start the frontend
cd app && npm run dev
```

Then open http://localhost:8821 in your browser.

## 💡 Feature Overview

### 1. Collapsible Asks

Each job can now show a list of "asks" (questions/clarifications) that can be expanded or collapsed:

```
┌─────────────────────────────────────┐
│ ✦ COMPLETE │ SONNET │ 2m ago        │
│ Implement user authentication       │
│ 📁 ~/project/auth                   │
│                                     │
│ ▶ 2 Asks  ← Click to expand        │
└─────────────────────────────────────┘
```

When expanded:
```
┌─────────────────────────────────────┐
│ ✦ COMPLETE │ SONNET │ 2m ago        │
│ Implement user authentication       │
│ 📁 ~/project/auth                   │
│                                     │
│ ▼ 2 Asks                            │
│ │ Q: Should I use JWT or sessions?  │
│ │ A: Use JWT tokens                │
│ │ 5m ago                            │
│ │                                   │
│ │ Q: Which database?                │
│ │ A: PostgreSQL                     │
│ │ 3m ago                            │
└─────────────────────────────────────┘
```

### 2. Light/Dark Mode Toggle

Click the **☀/🌙** button in the header to switch themes:

- **Dark Mode** (Default): Classic CRT green terminal aesthetic
- **Light Mode**: Clean, readable light theme with dark green text

## 🔧 Implementation Details

### Frontend Changes

**File**: `app/src/app/page.tsx`

1. Added `asks` field to Job interface:
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

2. New state variables:
```typescript
const [expandedAsks, setExpandedAsks] = useState<Set<string>>(new Set());
const [isDarkMode, setIsDarkMode] = useState(true);
```

3. Toggle function:
```typescript
const toggleAsks = (jobId: string, e: React.MouseEvent) => {
  e.stopPropagation();
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

### Backend Changes (Optional)

To support asks in the backend, you would need to:

1. Add `asks` field to `ClaudeJob` struct in `server/src/jobs.rs`:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeJob {
    // ... existing fields
    pub asks: Option<Vec<Ask>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ask {
    pub question: String,
    pub answer: Option<String>,
    pub timestamp: Option<i64>,
}
```

2. Update database schema to store asks (JSON column)
3. Add API endpoints to add/update asks

## 📝 Usage Examples

### Example 1: Job with Asks

```json
{
  "id": "abc123",
  "prompt": "Create a REST API for user management",
  "model": "sonnet",
  "status": "completed",
  "asks": [
    {
      "question": "Should I include email verification?",
      "answer": "Yes, use token-based verification",
      "timestamp": 1710234567
    },
    {
      "question": "Which authentication method?",
      "answer": "JWT with refresh tokens",
      "timestamp": 1710234589
    }
  ]
}
```

### Example 2: Job with Unanswered Asks

```json
{
  "id": "def456",
  "prompt": "Refactor database layer",
  "model": "opus",
  "status": "running",
  "asks": [
    {
      "question": "Should I preserve backward compatibility?",
      "timestamp": 1710234600
    }
  ]
}
```

## 🎨 Theme Colors

### Dark Mode
- Background: `#0a0a0a` (Very dark gray)
- Primary: `#33ff33` (CRT green)
- Accent: `#ffb000` (Amber)
- Asks: `#00aaff` (Blue)

### Light Mode
- Background: `#f5f5f0` (Off-white)
- Primary: `#2d5016` (Dark green)
- Accent: `#cc8800` (Dark amber)
- Asks: `#0066cc` (Dark blue)

## 🔮 Future Enhancements

- [ ] **Persistent Theme** - Save theme preference to localStorage
- [ ] **Backend Integration** - Full API support for asks CRUD operations
- [ ] **Real-time Asks** - Stream asks via SSE during job execution
- [ ] **Ask Filtering** - Filter jobs by unanswered asks
- [ ] **Inline Answering** - Answer asks directly in the UI
- [ ] **Ask History** - View edit history for asks
- [ ] **Export** - Export asks to markdown/JSON
- [ ] **Notifications** - Alert when new asks are added
- [ ] **Search Asks** - Search across all asks in all jobs

## 🐛 Known Limitations

1. **No Backend Support Yet** - Asks are only stored in memory (frontend state)
2. **No Persistence** - Asks are lost on page refresh
3. **No Real-time Updates** - Asks don't update via SSE stream yet
4. **Theme Not Persisted** - Theme preference resets on page refresh

## 💻 Development

### Testing the Feature

1. Modify `fetchJobs()` to inject mock asks:
```typescript
const fetchJobs = useCallback(async () => {
  // ... existing fetch logic
  const data = await res.json();

  // Add mock asks for testing
  const jobsWithAsks = data.jobs.map((job: Job) => ({
    ...job,
    asks: job.status === 'completed' ? [
      {
        question: "Test question 1?",
        answer: "Test answer 1",
        timestamp: Math.floor(Date.now() / 1000) - 300
      }
    ] : undefined
  }));

  setJobs(jobsWithAsks);
}, [token, authFetch]);
```

2. Or mock the entire response in development:
```typescript
setJobs([
  {
    id: "test-1",
    prompt: "Test task with asks",
    model: "sonnet",
    work_dir: "~/test",
    status: "completed",
    output: "Done!",
    error: null,
    pid: null,
    created_at: Math.floor(Date.now() / 1000) - 600,
    updated_at: Math.floor(Date.now() / 1000) - 300,
    asks: [
      {
        question: "Should I use TypeScript?",
        answer: "Yes",
        timestamp: Math.floor(Date.now() / 1000) - 500
      },
      {
        question: "Which framework?",
        answer: "Next.js",
        timestamp: Math.floor(Date.now() / 1000) - 400
      }
    ]
  }
]);
```

## 📚 Related Files

- `app/src/app/page.tsx` - Main component with asks UI
- `app/src/app/globals.css` - Theme styling
- `server/src/jobs.rs` - Backend job management (needs asks support)
- `server/src/api.rs` - API endpoints (needs asks endpoints)

## 🙏 Credits

Bismillah ░ Claude Jobs ░ Enhanced with Collapsible Asks & Light Mode

---

**Questions?** Open an issue or submit a PR!
