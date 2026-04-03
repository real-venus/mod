# Bridge Page Enhancements

## Overview
Enhanced the Bridge page to show comprehensive balance tracking, claimed history, and a detailed balance sheet.

## New Features

### 1. Balance Sheet Tab
A new "Balances" tab that displays:

#### Summary Cards
- **Total Balance**: Sum of all balances across all addresses
- **Total Claimed**: Sum of all claimed amounts with percentage
- **Total Unclaimed**: Remaining claimable amounts with percentage

#### Detailed Balance Table
Shows for each address:
- Sr25519 address (clickable to copy)
- Total balance
- Claimed amount
- Unclaimed amount
- Claim progress percentage

Sorted by total balance (descending).

#### Claimed History Section
List of all addresses that have claimed tokens:
- Sr25519 address
- Claimed amount
- Green checkmark indicator
- Sorted by claimed amount (descending)

### 2. Enhanced History Tab
Now shows two sections:

#### Recent Claims (This Session)
- Local claims from current session
- Shows status (pending/processing/completed/failed)
- Transaction hashes when available
- Timestamps

#### All Claimed History
- Complete historical data from bridge module
- All addresses that have ever claimed
- Total claimed amounts per address
- Persistent across sessions

### 3. Data Integration
The page now fetches data from the bridge module:
- `bridge/get_total_balances` - Gets snapshot of all balances
- `bridge/get_claims` - Gets all claimed amounts
- Automatically calculates unclaimed balances
- Real-time refresh capability

## UI Improvements
- Color-coded sections (cyan for total, green for claimed, orange for unclaimed)
- Refresh buttons with loading states
- Copy-to-clipboard functionality for all addresses
- Responsive table layout
- Smooth animations between tabs
- Loading skeletons

## Technical Details

### New State Variables
```typescript
balanceSheet: BalanceSheet | null
claimedHistory: Record<string, number>
loadingBalanceSheet: boolean
```

### New Functions
- `fetchBalanceSheet()`: Fetches and calculates balance sheet data
- Auto-loads on component mount when client is authenticated

### Tab System
Extended from ['claim', 'history'] to ['claim', 'history', 'balances']

## Usage
1. Navigate to Bridge page
2. If authenticated, data loads automatically
3. Click "Balances" tab to view complete balance sheet
4. Click "History" tab to see claimed history
5. Use refresh buttons to update data
6. Click any address to copy to clipboard
