# GitAgent + Claude Integration Guide 🤖

How to integrate GitAgent with Claude for AI-powered GitHub automation.

## Overview

GitAgent provides the `prepare_for_claude()` method to fetch repository files in a format ready for Claude processing. This enables AI-powered workflows like:

- Code review and suggestions
- Automated refactoring
- Bug detection and fixing
- Documentation generation
- Security audits

## Basic Integration

### 1. Fetch Repository Files

```python
import mod.core.mod as m

git = m.mod('gitagent')()
git.use_account("personal")

# Get all files from a repository
files = git.prepare_for_claude("owner/repo")

print(f"Fetched {files['file_count']} files")
# files['files'] is a dict: {path: content}
```

### 2. Process with Claude (Example)

```python
# Using mod framework's Claude integration
claude = m.mod('claude')()

# Analyze the codebase
response = claude.ask(
    f"Analyze this codebase and suggest improvements:\n\n{json.dumps(files['files'])}"
)

print(response)
```

## Workflow Examples

### Example 1: AI-Powered Code Review

```python
def ai_code_review(repo, pr_number):
    """Review a PR using Claude"""

    git = m.mod('gitagent')()

    # Get PR details
    pr = git.get_pr(repo, pr_number)

    # Get changed files (simplified - you'd need GitHub's diff API)
    # For now, we can get the full repo
    files = git.prepare_for_claude(repo)

    # Ask Claude to review
    claude = m.mod('claude')()

    review_prompt = f"""
    Review this pull request:

    Title: {pr['pr']['title']}
    Description: {pr['pr']['body']}

    Changed files: {pr['pr']['changed_files']}
    Additions: {pr['pr']['additions']}
    Deletions: {pr['pr']['deletions']}

    Repository context:
    {json.dumps(files['files'])}

    Please provide:
    1. Code quality assessment
    2. Potential bugs or issues
    3. Security concerns
    4. Suggestions for improvement
    """

    review = claude.ask(review_prompt)

    # Optionally post review as comment
    # (would need to implement comment API in GitAgent)

    return review


# Use it
review = ai_code_review("owner/repo", pr_number=123)
print(review)
```

### Example 2: Automated Bug Fixing

```python
def fix_bugs_with_claude(repo, file_path):
    """Use Claude to identify and fix bugs"""

    git = m.mod('gitagent')()
    claude = m.mod('claude')()

    # Get current file
    file = git.get_file(repo, file_path)

    # Ask Claude to find and fix bugs
    prompt = f"""
    Review this code for bugs and fix them:

    File: {file_path}
    ```
    {file['content']}
    ```

    Provide:
    1. List of bugs found
    2. Fixed version of the code
    """

    response = claude.ask(prompt)

    # Parse Claude's response to extract fixed code
    # (Implementation depends on response format)
    fixed_code = extract_code_from_response(response)

    # Create a PR with the fix
    git.create_branch(repo, "claude-bug-fixes")

    git.update_file(
        repo=repo,
        path=file_path,
        content=fixed_code,
        message="Fix bugs identified by Claude AI",
        branch="claude-bug-fixes",
        sha=file['sha']
    )

    pr = git.create_pr(
        repo=repo,
        title="AI-detected bug fixes",
        head="claude-bug-fixes",
        base="main",
        body=f"Claude AI identified and fixed bugs in {file_path}:\n\n{response}"
    )

    return pr['url']
```

### Example 3: Automated Documentation

```python
def generate_docs_with_claude(repo):
    """Generate documentation for a repository"""

    git = m.mod('gitagent')()
    claude = m.mod('claude')()

    # Get all code files
    files = git.prepare_for_claude(repo)

    # Ask Claude to generate docs
    prompt = f"""
    Generate comprehensive documentation for this codebase:

    {json.dumps(files['files'])}

    Create:
    1. README.md - Project overview and quick start
    2. API.md - API reference for all public functions
    3. CONTRIBUTING.md - Contribution guidelines

    Format as markdown.
    """

    response = claude.ask(prompt)

    # Parse response to extract individual docs
    # (Implementation depends on response format)
    docs = parse_docs_from_response(response)

    # Create branch for docs
    git.create_branch(repo, "ai-generated-docs")

    # Upload each doc file
    for doc_path, doc_content in docs.items():
        git.update_file(
            repo=repo,
            path=f"docs/{doc_path}",
            content=doc_content,
            message=f"Add AI-generated {doc_path}",
            branch="ai-generated-docs"
        )

    # Create PR
    pr = git.create_pr(
        repo=repo,
        title="Add AI-generated documentation",
        head="ai-generated-docs",
        base="main",
        body="Claude AI generated comprehensive documentation for the project."
    )

    return pr['url']
```

### Example 4: Security Audit

```python
def security_audit_with_claude(repo):
    """Run a security audit using Claude"""

    git = m.mod('gitagent')()
    claude = m.mod('claude')()

    # Get all files
    files = git.prepare_for_claude(repo)

    # Ask Claude to audit
    prompt = f"""
    Perform a security audit on this codebase:

    {json.dumps(files['files'])}

    Check for:
    1. SQL injection vulnerabilities
    2. XSS vulnerabilities
    3. Authentication/authorization issues
    4. Sensitive data exposure
    5. Insecure dependencies
    6. CSRF vulnerabilities
    7. Any other OWASP Top 10 issues

    Provide a detailed report with severity levels and recommendations.
    """

    audit_report = claude.ask(prompt)

    # Create an issue with the findings
    issue = git.create_issue(
        repo=repo,
        title="Security Audit Report (AI-generated)",
        body=audit_report,
        labels=["security", "audit"]
    )

    return issue['url']
```

### Example 5: Refactoring Assistant

```python
def refactor_with_claude(repo, target_files):
    """Use Claude to refactor code"""

    git = m.mod('gitagent')()
    claude = m.mod('claude')()

    # Get specific files
    files = git.prepare_for_claude(repo, files=target_files)

    # Ask Claude to refactor
    prompt = f"""
    Refactor this code for better:
    - Readability
    - Performance
    - Maintainability
    - Following best practices

    Files:
    {json.dumps(files['files'])}

    Provide refactored versions of each file.
    """

    response = claude.ask(prompt)

    # Parse refactored code
    refactored_files = parse_refactored_code(response)

    # Create branch
    git.create_branch(repo, "claude-refactor")

    # Update files
    for file_path, new_content in refactored_files.items():
        file = git.get_file(repo, file_path, branch="claude-refactor")

        git.update_file(
            repo=repo,
            path=file_path,
            content=new_content,
            message=f"Refactor {file_path} with Claude AI",
            branch="claude-refactor",
            sha=file['sha']
        )

    # Create PR
    pr = git.create_pr(
        repo=repo,
        title="AI-powered code refactoring",
        head="claude-refactor",
        base="main",
        body="Claude AI refactored the code for better readability and maintainability."
    )

    return pr['url']
```

## Advanced Patterns

### Batch Processing Across Multiple Repos

```python
def audit_all_repos():
    """Run security audit across all your repos"""

    git = m.mod('gitagent')()

    # Get all your repos
    repos = git.list_my_repos()

    results = []

    for repo in repos['repos'][:10]:  # Limit to first 10
        print(f"Auditing {repo['full_name']}...")

        audit_url = security_audit_with_claude(repo['full_name'])

        results.append({
            'repo': repo['full_name'],
            'audit_url': audit_url
        })

    return results
```

### Continuous Integration Hook

```python
def on_pr_created(repo, pr_number):
    """Automatically review new PRs with Claude"""

    # This could be triggered by a webhook

    review = ai_code_review(repo, pr_number)

    # Post review as comment
    # (needs comment API implementation)

    return review
```

## Claude Jobs Integration

If you're using the Claude module's job system:

```python
# Create a job for repo analysis
job_id = claude.create_job(
    task="analyze_repo",
    params={
        "repo": "owner/repo",
        "files": git.prepare_for_claude("owner/repo")
    }
)

# Job runs in background
# When complete, results are available
results = claude.get_job_results(job_id)
```

## Helper Functions

### Extract Code from Claude Response

```python
import re

def extract_code_from_response(response):
    """Extract code blocks from Claude's response"""

    # Find code blocks with ```
    code_blocks = re.findall(r'```(?:\w+)?\n(.*?)```', response, re.DOTALL)

    if code_blocks:
        return code_blocks[0]  # Return first code block

    return response  # Fallback to entire response
```

### Parse Multiple Files from Response

```python
def parse_docs_from_response(response):
    """Parse multiple doc files from Claude's response"""

    # Assuming Claude formats as:
    # ## README.md
    # ```markdown
    # content
    # ```

    docs = {}
    pattern = r'## ([\w\.]+)\n```\w*\n(.*?)```'

    matches = re.findall(pattern, response, re.DOTALL)

    for filename, content in matches:
        docs[filename] = content.strip()

    return docs
```

## Best Practices

1. **Token Limits**: Be mindful of Claude's token limits when sending large codebases
   - Use `prepare_for_claude(repo, files=[...])` to limit files
   - Process in batches if needed

2. **Rate Limiting**: Respect both GitHub and Claude API rate limits
   - Add delays between requests
   - Use batch operations efficiently

3. **Error Handling**: Always handle API errors gracefully
   ```python
   try:
       files = git.prepare_for_claude(repo)
   except Exception as e:
       print(f"Failed to fetch files: {e}")
       return
   ```

4. **Validation**: Validate Claude's output before applying changes
   - Review code changes before committing
   - Test generated code
   - Human review for security-critical changes

5. **Version Control**: Always create branches and PRs
   - Never commit AI-generated changes directly to main
   - Allow for human review

## Future Enhancements

Planned features for better Claude integration:

- [ ] Direct Claude module integration
- [ ] Job queue for batch processing
- [ ] Webhook support for automatic PR review
- [ ] Comment API for posting reviews
- [ ] Diff-only processing (send only changed files)
- [ ] Incremental updates based on git history
- [ ] Custom prompts and templates
- [ ] Result caching to avoid re-processing

## Examples Repository

See `examples.py` for more practical examples of GitAgent + Claude workflows.

## Support

For questions or issues:
- Check [README.md](README.md) for GitAgent docs
- See [TUTORIAL.md](TUTORIAL.md) for detailed examples
- Check Claude module docs for AI integration details

---

**Ready to supercharge your GitHub workflow with AI?** Start with `prepare_for_claude()` and build from there! 🚀
