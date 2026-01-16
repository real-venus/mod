# API Mechanics Documentation

## Overview

This API provides a decentralized module registry and execution system built on IPFS storage with cryptographic authentication. It enables secure, verifiable function calls across distributed modules.

## Core Architecture

### Components

1. **Storage Layer (IPFS)**: Content-addressed storage for modules and data
2. **Authentication Layer**: Token-based cryptographic verification
3. **Execution Layer**: Async task processing with futures
4. **Registry Layer**: Module versioning and discovery

## Authentication Mechanics

### Token Generation

```python
token = api.token(data={"query": "example"}, cost=0, to=recipient_address)
```

**Token Structure:**
```
key::to::cost::time::data::signature
```

**Components:**
- `key`: Sender's SS58 address
- `to`: Recipient's address
- `cost`: Token cost (float)
- `time`: Unix timestamp (int)
- `data`: JSON-encoded payload
- `signature`: Cryptographic signature

### Token Verification

```python
verified = api.auth.verify(token)
# Returns: {"key": address, "to": recipient, "cost": 0, "time": timestamp, "data": payload}
```

**Verification Process:**
1. Split token by `::` delimiter
2. Extract signature (last component)
3. Reconstruct data string
4. Verify signature against sender's public key
5. Return decoded token data

## Function Call Mechanics

### Call Flow

```python
result = api.call(fn="store/ls", params={"path": "/"}, wait=True)
```

**Execution Steps:**

1. **Task Creation**
   ```python
   task = {
       "fn": "store/ls",
       "params": params_cid,  # IPFS CID of params
       "timeout": 1000,
       "status": "pending",
       "time": timestamp,
       "cost": 1
   }
   ```

2. **Authentication**
   - Generate token with task data
   - Verify token signature
   - Extract caller's key from token

3. **Task Storage**
   ```python
   task_path = f"{calls_path}/{fn}/{time}.json"
   task_cid = ipfs.add(task)
   ```

4. **Async Execution**
   ```python
   future = executor.submit(run_task, **task)
   cid2future[task_cid] = future
   ```

5. **Result Handling**
   - If `wait=True`: Block until completion
   - If `wait=False`: Return task CID immediately

### Task Execution

```python
def run_task(**task):
    # 1. Parse function path
    mod_name, fn_name = task["fn"].split("/", 1)
    
    # 2. Load parameters from IPFS
    params = ipfs.get(task["params"])
    
    # 3. Check if remote server exists
    if mod_name in servers():
        result = client.call(fn=task["fn"], params=params)
    else:
        # 4. Verify function is allowed
        allowed_fns = get_fns(mod_name)
        assert fn_name in allowed_fns
        
        # 5. Execute locally
        result = mod.fn(fn_name)(**params)
    
    # 6. Store result in IPFS
    task["result"] = ipfs.add(result)
    task["status"] = "success"
    
    # 7. Generate owner token
    task["owner_token"] = auth.token(data=task, key=owner_key)
    
    # 8. Update task
    task["cid"] = ipfs.add(task)
    return task["cid"]
```

## Module Registration Mechanics

### Registration Flow

```python
info = api.reg(mod="mymod", key=my_key, comment="Initial release")
```

**Steps:**

1. **Content Hashing**
   ```python
   file2cid = {}
   for file, content in mod_files.items():
       file2cid[file] = ipfs.add(content)
   content_cid = ipfs.add({"data": ipfs.add(file2cid), "comment": comment})
   ```

2. **Schema Generation**
   ```python
   schema = extract_function_signatures(mod)
   schema_cid = ipfs.add(schema)
   ```

3. **Info Object Creation**
   ```python
   info = {
       "content": content_cid,
       "schema": schema_cid,
       "prev": previous_version_cid,
       "created": timestamp,
       "updated": timestamp,
       "name": mod_name,
       "key": owner_address,
       "collateral": 0,
       "protocal": "mod"
   }
   ```

4. **Signing**
   ```python
   info["signature"] = key.sign(info, mode="str")
   ```

5. **Registry Update**
   ```python
   registry[key_address][mod_name] = ipfs.add(info)
   save(registry_path, registry)
   ```

## Version Control Mechanics

### Version Chain

Each module version links to its predecessor:

```
v3 (current) -> v2 -> v1 -> None
```

**Traversal:**
```python
def versions(mod, n=4):
    cid = registry[key][mod]
    versions = []
    
    while cid and len(versions) < n:
        info = ipfs.get(cid)
        versions.append({
            "cid": cid,
            "comment": get_comment(info),
            "updated": info["updated"]
        })
        cid = info.get("prev")  # Follow chain
    
    return versions
```

## Transaction History

### Storage Structure

```
~/.mod/api/calls/
├── store/
│   └── ls/
│       ├── 1234567890.123.json
│       └── 1234567891.456.json
└── model/
    └── forward/
        └── 1234567892.789.json
```

### Query Mechanics

```python
txs = api.txs(mod="store", key=user_address, n=10, expand=True)
```

**Process:**
1. Glob all JSON files in calls directory
2. Filter by module name and key
3. Load and parse each transaction
4. Expand CIDs to actual data if `expand=True`
5. Sort by timestamp descending
6. Return top N results

## Oracle System (Prefi)

### Price Aggregation

```python
class Oracle:
    def get_price(self, asset):
        prices = []
        for source in ["chainlink", "pyth", "binance"]:
            prices.append(self.fetch(source, asset))
        
        return sum(prices) / len(prices)
```

### Confidence Scoring

```python
def confidence(prices):
    avg = sum(prices) / len(prices)
    max_dev = max(abs(p - avg) for p in prices)
    return 1 - (max_dev / avg)
```

## Security Model

### Cryptographic Verification

1. **Signature Generation**: `signature = key.sign(data, mode="str")`
2. **Verification**: `valid = verify(data, signature, address, mode="str")`
3. **Address Validation**: `valid = key.valid_ss58_address(address)`

### Access Control

```python
def get_fns(mod):
    # Only exposed functions can be called
    config = load_config(mod)
    return config.get("fns", []) + ["info", "forward"]
```

## Performance Optimizations

### Caching Strategy

```python
# Cache module list
path = "~/.mod/api/mods"
mods = get(path, max_age=2)  # 2 second cache

# Cache user data
user_path = f"~/.mod/api/users/{address}"
user = get(user_path, update=False)
```

### Async Execution

```python
# Non-blocking calls
task = api.call(fn="slow_function", wait=False)
# ... do other work ...
result = api.get(task["cid"])  # Check later
```

## Error Handling

```python
try:
    result = execute_function(**params)
    task["status"] = "success"
except Exception as e:
    result = detailed_error(e)
    task["status"] = "error"
```

## API Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/call` | POST | Execute module function |
| `/reg` | POST | Register/update module |
| `/mod/{name}` | GET | Get module info |
| `/versions/{name}` | GET | Get version history |
| `/txs` | GET | Query transactions |
| `/mods` | GET | List all modules |
| `/users` | GET | List all users |

## Best Practices

1. **Always verify tokens** before executing calls
2. **Use wait=False** for long-running operations
3. **Cache frequently accessed data** with appropriate TTL
4. **Sign all registry updates** with module owner key
5. **Store large data in IPFS**, reference by CID
6. **Version modules** with meaningful comments
7. **Expose only necessary functions** in module config

## Example: Complete Flow

```python
# 1. Initialize API
api = Api(store="ipfs", key="mykey")

# 2. Register module
info = api.reg(mod="calculator", comment="v1.0")

# 3. Generate auth token
token = api.auth.token(data={"operation": "add"}, key=api.key)

# 4. Call function
task = api.call(
    fn="calculator/add",
    params={"a": 5, "b": 3},
    token=token,
    wait=True
)

# 5. Get result
result = api.get(task)  # Returns 8

# 6. Check history
txs = api.txs(mod="calculator", n=10)
```

This documentation covers the core mechanics of the API system. For specific implementation details, refer to the source code in `/root/mod/mod/core/api/api/api.py`.