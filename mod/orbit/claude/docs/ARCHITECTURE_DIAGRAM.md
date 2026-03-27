# Claude Module Architecture - Unified Operations

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Claude Module API                           │
│                                                                   │
│  ┌──────────────────┐              ┌──────────────────┐         │
│  │  Read Operations │              │ Write Operations │         │
│  │  (No Permission) │              │ (Owner Required) │         │
│  ├──────────────────┤              ├──────────────────┤         │
│  │ • analyze_code() │              │ • edit_file()    │         │
│  │ • debug()        │              │ • generate_code()│         │
│  │ • ask()          │              │ • refactor()     │         │
│  └────────┬─────────┘              └─────────┬────────┘         │
│           │                                   │                  │
│           │ requires_owner=False              │ requires_owner=True
│           │                                   │                  │
│           └───────────────┬───────────────────┘                  │
│                           ↓                                      │
│                  ┌────────────────────┐                          │
│                  │   forward()        │                          │
│                  │  Unified Backend   │                          │
│                  └─────────┬──────────┘                          │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             ↓
                  ┌──────────────────────┐
                  │  Permission Check    │
                  │  (if requires_owner) │
                  └──────────┬───────────┘
                             ↓
                  ┌──────────────────────┐
                  │  Claude Code CLI     │
                  │  (Anthropic)         │
                  └──────────┬───────────┘
                             ↓
                  ┌──────────────────────┐
                  │  Execute & Stream    │
                  └──────────┬───────────┘
                             ↓
                  ┌──────────────────────┐
                  │  Store to IPFS       │
                  │  (if write operation)│
                  └──────────────────────┘
```

## Operation Flow: Read vs Write

### Read Operation Flow

```
User Code:
  mod.analyze_code(path="./src")
           ↓
Convenience Method:
  sets requires_owner=False
           ↓
forward():
  • No permission check
  • Execute immediately
           ↓
Claude Code CLI:
  • Read files
  • Analyze
  • Return insights
           ↓
Return Results:
  • No IPFS storage
  • Direct return
```

### Write Operation Flow

```
User Code:
  mod.edit_file("main.py", "Add error handling", key=owner_key)
           ↓
Convenience Method:
  sets requires_owner=True
           ↓
forward():
  • Check permission
  • require_owner(key)
           ↓
Permission Check:
  ├─ Is owner? → Continue
  └─ Not owner? → PermissionError
           ↓
Claude Code CLI:
  • Read files
  • Make changes
  • Write files
           ↓
Store to IPFS:
  • Create metadata
  • Upload to IPFS
  • Record CID
           ↓
Return Results:
  • Include IPFS CID
  • Gateway URL
```

## Auto-Detection Logic

```
forward(query="Fix the bug", requires_owner=None)
           ↓
Auto-detect keywords:
  "fix" found in query
           ↓
Set requires_owner=True
           ↓
Perform permission check
           ↓
Execute if authorized
```

## Permission Model

```
┌─────────────────────────────────────────────────────────┐
│                    Owner Configuration                   │
│                                                           │
│  Initial State: No owner set                             │
│  ├─ Anyone can perform any operation                     │
│  └─ First authenticated user becomes owner               │
│                                                           │
│  After set_owner(address):                               │
│  ├─ Read operations: Anyone can perform                  │
│  └─ Write operations: Only owner can perform             │
└─────────────────────────────────────────────────────────┘
```

## Backend System

```
┌─────────────────────────────────────────────────────────┐
│                Backend Registry (Optional)               │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Claude Code  │  │  Dev Tools   │  │   Codex      │  │
│  │   Backend    │  │   Backend    │  │  Backend     │  │
│  │  (Default)   │  │  (mod eco)   │  │  (OpenAI)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│         └──────────────────┴──────────────────┘          │
│                            │                             │
│                    All implement:                        │
│                    • forward()                           │
│                    • is_available()                      │
│                    • install()                           │
└─────────────────────────────────────────────────────────┘
```

## IPFS Integration

```
Write Operation Completed
           ↓
Create metadata:
  {
    query: "Fix bug in login.py",
    result: {...},
    work_dir: "./src",
    model: "sonnet",
    timestamp: 1234567890
  }
           ↓
Upload to IPFS:
  ipfs.put(metadata)
           ↓
Store CID:
  Save to ~/.mod/claude/cid_history.json
           ↓
Return to user:
  {
    result: {...},
    cid: "Qm...",
    gateway: "https://ipfs.io/ipfs/Qm..."
  }
```

## Component Relationships

```
┌──────────────────────────────────────────────────────────┐
│                     claude.py (Main)                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │                  Mod Class                          │  │
│  │  • forward() - Core execution                       │  │
│  │  • require_owner() - Permission check               │  │
│  │  • analyze_code() - Read convenience                │  │
│  │  • edit_file() - Write convenience                  │  │
│  │  • ... 20+ methods                                  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────┬───────────────────────────────────────┘
                   │
       ┌───────────┴────────────┐
       ↓                        ↓
┌─────────────┐         ┌─────────────┐
│ backends.py │         │   ipfs mod  │
│  (Optional) │         │ (Storage)   │
└─────────────┘         └─────────────┘
       ↓
┌─────────────┐
│ Claude CLI  │
│ (Anthropic) │
└─────────────┘
```

## State Management

```
┌─────────────────────────────────────────────────────────┐
│                   Module State                           │
│                                                           │
│  ~/.mod/claude/                                          │
│  ├── owner.json                                          │
│  │   {"owner": "0x1234..."}                             │
│  │                                                       │
│  ├── cid_history.json                                    │
│  │   [                                                   │
│  │     {                                                 │
│  │       "cid": "Qm...",                                 │
│  │       "timestamp": 1234567890,                        │
│  │       "description": "Edit utils.py"                  │
│  │     }                                                 │
│  │   ]                                                   │
│  │                                                       │
│  └── config_cid.json                                     │
│      {                                                   │
│        "cid": "Qm...",                                   │
│        "urls": {                                         │
│          "app": "http://localhost:8821",                 │
│          "api": "http://localhost:8820"                  │
│        }                                                 │
│      }                                                   │
└─────────────────────────────────────────────────────────┘
```

## Key Design Principles

1. **Single Responsibility**: `forward()` handles all execution
2. **Explicit Control**: Operations declare permission requirements
3. **Smart Defaults**: Auto-detection for convenience
4. **Fail Safe**: Defaults to requiring permission when unsure
5. **Auditability**: All write operations stored to IPFS
6. **Extensibility**: Pluggable backend system for future growth

## Benefits Summary

```
┌────────────────────────────────────────────────────────┐
│                    Unified Benefits                     │
│                                                          │
│  Before (Hypothetical Split):                           │
│  ├─ Separate code paths                                 │
│  ├─ Duplicate logic                                     │
│  ├─ Inconsistent behavior                               │
│  └─ More maintenance burden                             │
│                                                          │
│  After (Unified):                                       │
│  ├─ Single code path                                    │
│  ├─ Shared logic                                        │
│  ├─ Consistent behavior                                 │
│  ├─ Flexible permissions                                │
│  ├─ Auto-detection                                      │
│  └─ Clear separation via flags                          │
└────────────────────────────────────────────────────────┘
```
