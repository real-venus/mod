# embedcode

Generate and search embeddings of code using local models.

## Structure

```
embedcode/
├── embedcode/
│   ├── mod.py        # Core: embed, search, serve/kill/status
│   ├── api.py        # FastAPI gateway
│   ├── config.json   # Ports & schema
│   └── app/          # Next.js frontend
│       └── src/app/
│           ├── layout.tsx
│           └── page.tsx
└── README.md
```

## Usage

```python
import mod as m

ec = m.mod('embedcode')()

# Embed a codebase
ec.embed(path='./src')

# Search by meaning
results = ec.search(query='authentication middleware')

# List collections
ec.collections()
```

```bash
# CLI
m embedcode embed path=./src
m embedcode search query="error handling"
m embedcode serve
m embedcode app
m embedcode status
m embedcode kill
```

## API

```
POST /embed       - embed a path
POST /search      - semantic search
GET  /collections - list collections
GET  /health      - health check
GET  /status      - module status
```

## Model

Uses `sentence-transformers/all-MiniLM-L6-v2` by default (384-dim, runs locally). Pass `model='...'` to use a different model.

## Ports

- API: `8920`
- App: `3920`
