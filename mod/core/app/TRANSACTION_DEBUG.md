# Transaction Display Issue - Debug Analysis

## Problem
No transactions are showing in the TransactionsPanel component.

## Root Cause Analysis

### 1. API Call Issue (Line 42 in TransactionsPanel.tsx)
```typescript
const result = await client.call('history', { df: 0, n: pageSize, page: page })
```

**Problem**: The `history` endpoint is being called, but based on the codebase:
- The client.ts shows the API expects function calls in format: `${url}/${fn}`
- The ModTransactions.tsx (line 45) uses: `client.call('call', { fn: 'api/h', params: {} })`
- This suggests transactions should be fetched via `call` with a specific function path

### 2. Filter Logic Issue (Lines 81-92)
```typescript
const filteredTransactions = transactions.filter(tx => {
  if (showOnlyMyTx && tx.client !== myClientKey) return false
  if (!showOnlyMyTx && tx.client === myClientKey) return false  // <-- BUG!
  // ...
})
```

**CRITICAL BUG**: Line 83 filters OUT user's own transactions when `showOnlyMyTx` is FALSE!
This means:
- When showing "all transactions", it excludes the user's transactions
- When showing "my transactions", it only shows user's transactions
- Result: Transactions may be fetched but filtered out incorrectly

### 3. Potential API Endpoint Mismatch
The `history` function may not exist or may return data in unexpected format.

## Solutions

### Fix 1: Correct Filter Logic (IMMEDIATE)
Change line 83 from:
```typescript
if (!showOnlyMyTx && tx.client === myClientKey) return false
```
To:
```typescript
// Remove this line entirely - show all transactions when not filtering
```

### Fix 2: Update API Call (if history endpoint doesn't exist)
Change line 42 from:
```typescript
const result = await client.call('history', { df: 0, n: pageSize, page: page })
```
To:
```typescript
const result = await client.call('call', { fn: 'api/history', params: { df: 0, n: pageSize, page: page } })
```

### Fix 3: Add Debug Logging
Add console logs to verify:
- API response format
- Number of transactions received
- Filter results

## Recommended Fix

The filter logic bug on line 83 is the most likely culprit. This should be fixed immediately.

```typescript
const filteredTransactions = transactions.filter(tx => {
  if (showOnlyMyTx && tx.client !== myClientKey) return false
  // REMOVED: if (!showOnlyMyTx && tx.client === myClientKey) return false
  if (!searchTerm) return true
  const search = searchTerm.toLowerCase()
  return tx.fn.toLowerCase().includes(search) || 
         tx.client?.toLowerCase().includes(search) ||
         tx.status.toLowerCase().includes(search) ||
         tx.signature?.toLowerCase().includes(search) ||
         tx.key?.toLowerCase().includes(search) ||
         tx.cid?.toLowerCase().includes(search)
})
```

## Testing Steps
1. Remove line 83 filter
2. Check if transactions appear
3. If not, verify API endpoint returns data
4. Check browser console for errors
5. Verify transaction data structure matches interface
