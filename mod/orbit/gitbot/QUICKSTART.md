# GitBot Quick Start ⚡

Get started with GitBot in 5 minutes.

## 1. Install Dependencies

```bash
cd /Users/broski/mod/mod/orbit/gitbot
pip install -r requirements.txt
```

## 2. Get GitHub Token

1. Go to: https://github.com/settings/tokens/new
2. Generate token with `repo` scope
3. Copy the token (starts with `ghp_`)

## 3. Authenticate

```python
import mod as m

# Initialize and authenticate
bot = m.mod('gitbot')()
bot.auth(token='ghp_your_token_here')

# Verify
status = bot.get_user()
print(f"Logged in as: {status['user']['login']}")
```

## 4. Set Your Vibes

```python
# Define your signature style
vibes = {
    "commit_style": "short",
    "tone": "casual",
    "emoji_preference": True,
    "sign_off": "✨ Made with mod framework"
}

bot.save_vibes(vibes)
```

## 5. Create Your First PR

```python
# Create a branch
bot.create_branch(
    repo="yourusername/your-repo",
    branch_name="docs/add-readme",
    from_branch="main"
)

# Commit a file
bot.commit_file(
    repo="yourusername/your-repo",
    path="README.md",
    content="# My Project\n\nAwesome README!",
    message="Add README",
    branch="docs/add-readme"
)

# Create PR
pr = bot.create_pr(
    repo="yourusername/your-repo",
    title="📚 Add README",
    body="Adds project README",
    head="docs/add-readme",
    base="main"
)

print(f"PR created: {pr['pr_url']}")
```

## 🎉 Done!

You've created your first automated PR with GitBot!

## Next Steps

- 📖 Read [TUTORIAL.md](TUTORIAL.md) for advanced workflows
- 🎨 Customize your vibes
- 🚀 Automate your GitHub workflow
- 🤖 Build bot scripts

## Common Commands

```python
# Fork a repo
bot.fork_repo("owner/repo")

# List PRs
bot.list_prs("owner/repo", state="open")

# Get file content
bot.get_file(repo="owner/repo", path="file.txt")

# Update existing file
file = bot.get_file(repo="owner/repo", path="file.txt")
bot.commit_file(
    repo="owner/repo",
    path="file.txt",
    content="new content",
    message="update",
    branch="main",
    sha=file['sha']  # Important!
)
```

## Tips

- 💾 Token is saved in `~/.mod/gitbot/config.json`
- 🎨 Vibes are saved in `~/.mod/gitbot/vibes.json`
- 😊 Emojis auto-add based on commit message
- 📝 Sign-off auto-appends to PRs

## Need Help?

- 📘 [Full Documentation](README.md)
- 🎓 [Tutorial](TUTORIAL.md)
- 💡 [Examples](examples.py)

---

**Happy automating! 🚀**
