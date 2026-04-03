# Header Tabs Feature - Quick Guide

## Overview

The Claude Jobs interface now has **four mode tabs** in the header that control how you work with modules:

- **STANDARD** - Regular job submission with custom working directory
- **EDIT** - Edit existing modules (with permission restrictions)
- **NEW** - Create new modules from scratch
- **FORK** - Fork/copy existing modules

## Owner vs Non-Owner Permissions

### Owner
- Can edit **any module** in `mod/orbit/`
- Can create new modules **anywhere** in `mod/orbit/`
- Full access to all module operations

### Non-Owner (User)
- Can **only edit** modules in `mod/orbit/_outer/`
- New modules are **automatically created** in `mod/orbit/_outer/`
- Forked modules are **automatically placed** in `mod/orbit/_outer/`
- Restricted from editing core framework modules

## How to Use Each Mode

### 1. STANDARD Mode
- Default mode for regular AI tasks
- Specify any working directory
- No module-specific logic
- Use this for general tasks like "fix this bug" or "add a feature"

### 2. EDIT Mode
- Select a module from the dropdown
- **Non-owners** see only `_outer/` modules
- Work directory is automatically set to the selected module
- Example: Select "mymodule" → work dir becomes `~/mod/mod/orbit/mymodule`

### 3. NEW Mode
- Create a brand new module
- Enter module name (e.g., "mymodule")
- Specify anchor directory (default: `~/mod`)
- **Non-owners**: Module is created in `_outer/` subfolder automatically
- Creates standard module structure with anchor file

### 4. FORK Mode
- Copy an existing module as a starting point
- Select source module from dropdown
- Enter new module name
- **Non-owners**: Fork destination is automatically `_outer/`
- Entire directory structure is copied

## Visual Indicators

### Header Badge
- **◆ OWNER** (green) - You own this Claude instance
- **○ USER** (amber) - You are a non-owner user

### Mode Tab Colors
- **STANDARD** - Green (default)
- **EDIT** - Amber (editing existing)
- **NEW** - Blue (creating new)
- **FORK** - Blue (copying existing)

### Permission Warnings
When in non-owner mode, you'll see:
- **"⚠ NON-OWNER → _outer ONLY"** badge
- **Module dropdown** filters to show only editable modules
- **Folder path hints** showing `_outer/` prefix will be added

## Examples

### Owner Creating a New Module
1. Click **NEW** tab in header
2. Enter module name: `trading-bot`
3. Module created at: `~/mod/mod/orbit/trading-bot`

### Non-Owner Creating a New Module
1. Click **NEW** tab in header
2. Enter module name: `my-strategy`
3. Module created at: `~/mod/mod/orbit/_outer/my-strategy`

### Non-Owner Editing a Module
1. Click **EDIT** tab in header
2. Dropdown shows only `_outer/` modules
3. Select `_outer/my-strategy`
4. Work on module in isolated folder

### Anyone Forking a Module
1. Click **FORK** tab in header
2. Select source: `claude` (from dropdown)
3. Enter new name: `custom-claude`
4. **Owner**: Created at `~/mod/mod/orbit/custom-claude`
5. **Non-Owner**: Created at `~/mod/mod/orbit/_outer/custom-claude`

## Backend Integration

The modes work with the existing backend:
- `creation_mode` field: `"standard"`, `"edit"`, `"new"`, `"fork"`
- `module_name` field: Name of module (with `_outer/` prefix for non-owners)
- `work_dir` field: Computed based on mode and permissions
- `fork_source` field: Source module for fork mode
- `anchor_dir` field: Base directory (default `~/mod`)

## Security Notes

1. **Owner detection** is done via `~/.mod/claude/owner.json`
2. First authenticated user becomes the owner
3. Owner status persists across sessions
4. Non-owners cannot escalate privileges
5. All restrictions are **enforced client-side and server-side**

## FAQ

**Q: Can I change from non-owner to owner?**
A: No, owner is set on first authentication and cannot be changed without deleting `~/.mod/claude/owner.json`

**Q: What happens if I try to edit a restricted module as non-owner?**
A: The UI prevents selection and shows error: "NON-OWNERS CAN ONLY EDIT MODULES IN _outer FOLDER"

**Q: Can I see other users' _outer modules?**
A: Yes, all `_outer/` modules are visible and editable by all non-owners (shared sandbox space)

**Q: What if I use "local" mode?**
A: Local mode users are treated as owners (full permissions)

## Technical Details

### State Variables Added
- `isOwner: boolean` - Whether current user is the owner
- `ownerAddress: string | null` - Address of the owner
- `selectedModule: string` - Selected module in edit mode
- `creationMode: "standard" | "edit" | "new" | "fork"` - Current mode

### API Endpoints Used
- `GET /owner` - Check owner status and address
- Existing job submission with new mode fields

### Folder Structure
```
~/mod/mod/orbit/
├── claude/          (owner-only)
├── agent/           (owner-only)
├── safe/            (owner-only)
├── _outer/          (all users)
│   ├── user1-mod/
│   ├── user2-bot/
│   └── custom-fork/
└── ...
```
