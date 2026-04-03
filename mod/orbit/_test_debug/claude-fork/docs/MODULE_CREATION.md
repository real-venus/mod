# Module Creation Guide

The Claude Jobs system now supports creating and forking modules directly from the interface.

## Features

### 1. **Standard Mode** (Default)
Run Claude tasks in any working directory:
```python
c = Mod()
job = c.submit("fix the bug", work_dir="~/project")
```

### 2. **New Module Mode**
Create a new module in the orbit directory:

**Python:**
```python
c = Mod()

# Using helper method
job = c.create_module("myapi", "Create a REST API module with FastAPI")

# Or using submit with parameters
job = c.submit(
    prompt="Create a REST API module with FastAPI",
    module_name="myapi",
    creation_mode="new",
    anchor_dir="~/mod"  # optional, defaults to ~/mod or MOD_ANCHOR env var
)
```

**Web UI:**
1. Click "NEW MODULE" mode
2. Set anchor directory (default: `~/mod`)
3. Enter module name (e.g., `myapi`)
4. Describe what the module should do
5. Submit

The module will be created at: `{anchor_dir}/mod/orbit/{module_name}/`

### 3. **Fork Module Mode**
Clone an existing module and customize it:

**Python:**
```python
c = Mod()

# Using helper method
job = c.fork_module(
    module_name="myagent",
    fork_source="agent",
    prompt="Add web scraping and data extraction capabilities"
)

# Or using submit with parameters
job = c.submit(
    prompt="Add web scraping capabilities",
    module_name="myagent",
    creation_mode="fork",
    fork_source="agent",
    anchor_dir="~/mod"
)
```

**Web UI:**
1. Click "FORK MODULE" mode
2. Set anchor directory
3. Enter new module name
4. Select module to fork from dropdown
5. Describe customizations
6. Submit

Claude will:
1. Copy the entire source module directory
2. Apply your customizations
3. Update the module structure as needed

## Anchor Directory Configuration

### Environment Variable
Set a global anchor directory:
```bash
export MOD_ANCHOR=~/my-custom-location
```

### Per-Request Override
Specify anchor directory for individual requests:
```python
job = c.create_module("test", "test module", anchor_dir="~/custom/path")
```

### Default Behavior
- If not specified, defaults to `~/mod`
- Modules are created in: `{anchor_dir}/mod/orbit/{module_name}/`

## Module Structure

### New Module
Creates basic structure:
```
{anchor_dir}/mod/orbit/{module_name}/
├── mod.py          # Main module file (or {module_name}.py)
├── README.md       # Module documentation
└── ...             # Additional files as needed
```

### Forked Module
Copies entire source structure:
```
{anchor_dir}/mod/orbit/{module_name}/
├── [all files from source module]
└── [customizations applied by Claude]
```

## Examples

### Create a Web Scraper Module
```python
c = Mod()
job = c.create_module(
    module_name="webscraper",
    prompt="Create a web scraping module with BeautifulSoup and requests. "
           "Include methods for HTML parsing, data extraction, and export to JSON/CSV."
)

# Monitor progress
c.tail(job['id'])
```

### Fork and Customize Agent Module
```python
c = Mod()
job = c.fork_module(
    module_name="research_agent",
    fork_source="agent",
    prompt="Fork the agent module and add capabilities for academic research: "
           "- ArXiv paper search and download "
           "- Citation extraction "
           "- Summary generation "
           "- Bibliography formatting"
)
```

### Create API Module with Custom Anchor
```python
c = Mod()
job = c.create_module(
    module_name="myapi",
    prompt="Create a FastAPI REST API with authentication, rate limiting, and CRUD operations",
    anchor_dir="/Users/me/projects/custom-mod"
)
```

## Web UI Workflow

### Standard Task (Existing Behavior)
1. Select "STANDARD" mode
2. Choose working directory
3. Enter task description
4. Submit

### Create New Module
1. Select "NEW MODULE" mode
2. Set anchor directory (or use default)
3. Enter module name (e.g., `image_processor`)
4. Describe functionality: "Create an image processing module with PIL"
5. Click "EXECUTE TASK"

Claude will:
- Create directory at `~/mod/mod/orbit/image_processor/`
- Generate module structure
- Implement functionality
- Show real-time progress

### Fork Existing Module
1. Select "FORK MODULE" mode
2. Set anchor directory
3. Enter new module name (e.g., `custom_claude`)
4. Choose source module from dropdown (e.g., `claude`)
5. Describe changes: "Add voice recognition and TTS capabilities"
6. Click "EXECUTE TASK"

Claude will:
- Copy `~/mod/mod/orbit/claude/` → `~/mod/mod/orbit/custom_claude/`
- Apply customizations
- Update configuration
- Show real-time progress

## Tips

1. **Descriptive Names**: Use clear module names (e.g., `sentiment_analyzer` not `sa`)

2. **Detailed Prompts**: Provide specific requirements:
   ```python
   prompt = """
   Create a sentiment analysis module:
   - Use transformers library
   - Support batch processing
   - Include confidence scores
   - Export results to JSON/CSV
   - Add CLI interface
   """
   ```

3. **Fork for Variants**: Fork existing modules to create specialized versions:
   - Fork `agent` → `research_agent`, `support_agent`, `coding_agent`
   - Fork `api` → `public_api`, `internal_api`, `graphql_api`

4. **Anchor Organization**: Use different anchors for different projects:
   ```python
   # Personal tools
   c.create_module("mytool", "...", anchor_dir="~/personal")

   # Work projects
   c.create_module("worktool", "...", anchor_dir="~/work")
   ```

5. **Watch Progress**: Use `tail()` to monitor module creation:
   ```python
   job = c.create_module("mymodule", "...")
   c.tail(job['id'])  # Live stream output
   ```

## Architecture Notes

- **Backend**: Rust server (`jobs.rs`) handles module creation logic
- **Frontend**: Next.js UI provides mode selection and configuration
- **Python API**: Convenience methods wrap job submission
- **Prompt Enhancement**: Server automatically enhances prompts with module creation context

## Environment Variables

- `MOD_ANCHOR`: Default anchor directory (default: `~/mod`)
- `CLAUDE_JOBS_URL`: Server URL (default: `http://localhost:8820`)
- `CLAUDE_JOBS_LOCAL`: Set to `1` to skip authentication

## Troubleshoties

**Module already exists:**
Claude will warn you and ask if you want to overwrite or create a variant.

**Fork source not found:**
Ensure the source module exists in `{anchor_dir}/mod/orbit/`.

**Permission issues:**
Check directory permissions for the anchor location.

**Invalid module name:**
Use lowercase with hyphens or underscores (e.g., `my-module` or `my_module`).
