# Lighthouse Storage

Decentralized storage adapter for [Lighthouse](https://lighthouse.storage) (IPFS + Filecoin).

## Setup

```bash
pip install lighthouseweb3
export LIGHTHOUSE_TOKEN="your-api-token"
```

Get a token at https://files.lighthouse.storage

## Usage

```python
from lighthouse.mod import LighthouseClient

lh = LighthouseClient()

# Upload file
cid = lh.upload('/path/to/file.txt')

# Upload JSON data
cid = lh.put({'key': 'value'})

# Upload with tag
cid = lh.upload('/path/to/file.txt', tag='my-project')

# Download
data = lh.get(cid)           # JSON
raw = lh.cat(cid)            # bytes
lh.download(cid, './out.txt') # to file
url = lh.get_url(cid)        # gateway URL

# Status
lh.uploads()                 # list uploads
lh.info(cid)                 # file info
lh.deal_status(cid)          # Filecoin deal status
lh.balance()                 # storage balance
lh.tagged('my-project')      # files by tag

# IPNS
key = lh.ipns_keygen()
lh.ipns_publish(cid, key_name)
lh.ipns_keys()
lh.ipns_remove(key_name)
```

## Via mod framework

```python
import mod as m
lh = m.mod('lighthouse')()
cid = lh.put({'hello': 'world'})
```
