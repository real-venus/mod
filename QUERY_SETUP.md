# Free Model Query Setup

You now have a complete setup to query free models from OpenRouter and optionally Venice AI.

## What Was Created

1. **Standalone Script** (`query_free.py`):
   - Command-line tool for querying free models
   - Located at: `/Users/broski/mod/query_free.py`

2. **Query Module** (`mod/orbit/query/`):
   - Integrated mod framework module
   - Python API for easy integration
   - Auto-selects free models from OpenRouter

## Quick Start

### Using the Standalone Script

```bash
# Simple query
python query_free.py "What is the capital of France?"

# List all free models
python query_free.py --list

# Use Venice AI
python query_free.py "Explain AI" --venice

# Custom settings
python query_free.py "Tell me a story" --max-tokens 2048 --no-stream
```

### Using the Module (Recommended)

```python
import mod as m

# Create query instance
q = m.mod('query')()

# Simple query
response = q.query("What is machine learning?")
print(response)

# Stream response
for chunk in q.query("Tell me a story", stream=True):
    print(chunk, end='')

# Use Venice
response = q.query("Explain AI", use_venice=True)

# List free models
models = q.list_free_models(info=True)
```

### Via CLI

```bash
# Query using mod CLI
m query/query "What is the capital of France?"

# List free models
m query/list_free_models info=true

# Query with Venice
m query/query "Explain AI" use_venice=true
```

## Available Free Models

Currently 28+ free models from OpenRouter including:

- **inclusionai/ling-2.6-flash:free** (262K context)
- **google/gemma-4-26b-a4b-it:free** (262K context)
- **google/gemma-4-31b-it:free** (262K context)
- **google/lyria-3-pro-preview** (1M context)
- **nvidia/nemotron-3-super-120b-a12b:free** (262K context)
- **minimax/minimax-m2.5:free** (196K context)
- **liquid/lfm-2.5-1.2b-thinking:free** (32K context)
- And more...

## Key Features

1. **Automatic Free Model Selection**: No need to pick a model, the system automatically selects a free one
2. **Multiple Providers**: Support for both OpenRouter and Venice AI
3. **Streaming Support**: Get responses as they're generated
4. **No Setup Required**: Uses existing API keys from openrouter/venice modules
5. **CLI and Python API**: Use whichever interface you prefer

## Examples

### Question Answering

```python
q = m.mod('query')()
answer = q.query("What is the difference between AI and ML?")
print(answer)
```

### Streaming Chat

```python
q = m.mod('query')()
for chunk in q.query("Tell me about quantum computing", stream=True):
    print(chunk, end='', flush=True)
```

### Specific Model

```python
q = m.mod('query')()
response = q.query(
    "Explain neural networks",
    model="google/gemma-4-31b-it:free",
    max_tokens=2048
)
```

## Configuration

The module uses existing OpenRouter/Venice API keys. If not already set:

```bash
# For OpenRouter
m openrouter/add_key "sk-or-v1-..."

# For Venice
m venice/add_key "sk-venice-..."
```

## How It Works

1. **OpenRouter Mode** (default):
   - Fetches list of free models from OpenRouter API
   - Selects the first available free model
   - Routes your query to that model
   - Returns the response

2. **Venice Mode** (use_venice=True):
   - Uses Venice AI's default model
   - Routes query to Venice API
   - Returns response

3. **Response Handling**:
   - Non-streaming: Returns complete text
   - Streaming: Returns generator yielding chunks
   - History is automatically saved for both modes

## Troubleshooting

**"No free models available":**
```python
# Force refresh from API
models = q.list_free_models(update=True)
```

**"Context length exceeded":**
```python
# Reduce max_tokens
response = q.query("...", max_tokens=2048)
```

**API key issues:**
```python
# Check if keys are set
router = m.mod('openrouter')()
print(router.keys())
```

## Files Created

- `/Users/broski/mod/query_free.py` - Standalone CLI script
- `/Users/broski/mod/mod/orbit/query/mod.py` - Module implementation
- `/Users/broski/mod/mod/orbit/query/config.json` - Module config
- `/Users/broski/mod/mod/orbit/query/README.md` - Documentation

## Next Steps

1. Try querying with different prompts
2. Explore different free models
3. Compare OpenRouter vs Venice responses
4. Integrate into your workflows

Enjoy querying with free models!
