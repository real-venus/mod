# Owner System - Quick Reference

## TL;DR

**First person to sign in = Owner**

No config needed. Just start the server and authenticate.

## Check Owner Status

### API
```bash
curl http://localhost:8820/owner
```

### Python
```python
import mod as m
c = m.mod('claude')()
print(c.get_owner())  # Current owner address or None
```

### File
```bash
cat ~/.mod/claude/owner.json
```

## Common Commands

### Reset Owner (Allow New First User)
```bash
rm ~/.mod/claude/owner.json
```

### Set Owner Manually
```bash
echo '{"owner": "0xYOUR_ADDRESS"}' > ~/.mod/claude/owner.json
```

### Check If You're Owner (Python)
```python
c.is_owner(m.key())  # Returns True/False
```

### Reload Owner (After First Auth)
```python
c.reload_owner()  # Reloads from disk
```

## Permission Levels

| Operation | Owner | Non-Owner |
|-----------|-------|-----------|
| `ask()` | ✅ | ✅ |
| `analyze_code()` | ✅ | ✅ |
| `debug()` | ✅ | ✅ |
| `edit_file()` | ✅ | ❌ |
| `generate_code()` | ✅ | ❌ |
| `refactor()` | ✅ | ❌ |

## Troubleshooting

### "Access denied" error
→ You're not the owner. Check: `c.get_owner()` vs `m.key().address`

### Owner file corrupted
→ Delete and restart: `rm ~/.mod/claude/owner.json`

### Want to change owner
→ Edit file: `echo '{"owner": "0xNEW"}' > ~/.mod/claude/owner.json`

### No owner being set on first auth
→ Check server logs for errors
→ Verify `~/.mod/claude/` directory is writable

## Flow

```
No owner.json → First auth → owner.json created → Subsequent auths (no change)
```

## Files

- **Config**: `~/.mod/claude/owner.json`
- **Format**: `{"owner": "0x..."}`
- **Backend**: `server/src/auth.rs` (auto-creation)
- **Endpoint**: `GET /owner` (status check)
- **Python**: `claude/claude.py` (ownership methods)

## Links

- [AUTO_OWNER_SETUP.md](./AUTO_OWNER_SETUP.md) - Full guide
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Technical details
- [README.md](./README.md) - Main documentation
