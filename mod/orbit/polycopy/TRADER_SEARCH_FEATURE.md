# Trader Search & Profit/Loss Analysis Feature

## Overview
This document describes the comprehensive trader search and P&L analysis feature built for Polycopy, allowing users to discover profitable Polymarket traders and analyze their performance metrics in detail.

## Features

### 1. **Trader Discovery Interface**
- **Location**: `polycopy/app/components/TraderDiscovery.tsx`
- **Accessible via**: Main app "Discover" tab (default landing page)

#### Search & Filter Capabilities
- **Time Windows**: 1d, 7d, 30d, All Time
- **Sort Options**:
  - APR (Annualized Return) - Default
  - Profit & Loss (PnL)
  - Volume
  - ROI (Return on Investment)
- **Filters**:
  - Minimum Volume (USD)
  - Minimum APR (%)
  - Result Limit (up to 100)

#### Trader List Display
Each trader in the search results shows:
- ✅ **Checkbox**: Select multiple traders for bulk monitoring
- 🔢 **Rank**: Position in leaderboard
- 📍 **Address**: Wallet address (shortened format)
- 💰 **PnL**: Total Profit & Loss (color-coded: green for profit, red for loss)
- 📊 **Volume**: Total trading volume
- 📈 **ROI**: Return on Investment percentage
- 🚀 **APR**: Annualized Percentage Return
- 📉 **Sharpe**: Risk-adjusted return metric
- 👁️ **Details Button**: View comprehensive trader profile

### 2. **Detailed Trader Profile Modal**
Click the "Details" button on any trader to open a comprehensive profile view.

#### Performance Metrics Section
- **Profit & Loss**: Total earnings/losses
- **Total Volume**: Cumulative trading volume
- **ROI**: Overall return percentage
- **APR**: Annualized return rate

#### Trading Activity Section
- **Leaderboard Rank**: Global ranking among all traders
- **Total Trades**: Number of completed trades
- **Active Positions**: Currently open positions
- **Portfolio Value**: Total value of active positions

#### Current Positions Table
Shows up to 10 active positions with:
- Market question/description
- Outcome (Yes/No)
- Position size
- Current value

#### Recent Trades Table
Displays recent trading activity with:
- Trade side (BUY/SELL)
- Market question
- Trade price
- Quantity

#### Quick Actions
- **Close**: Return to trader list
- **Add to Monitor**: Add trader to monitoring list and switch to Monitor tab

### 3. **Backend API Endpoints**

#### Trader Search
```
GET /api/traders/search
Parameters:
  - window: '1d' | '7d' | '30d' | 'all'
  - limit: number (max 100)
  - min_volume: number
  - min_pnl: number
  - min_apr: number
  - min_roi: number
  - sort_by: 'apr' | 'pnl' | 'vol' | 'roi'
```

#### Top APR Traders
```
GET /api/traders/top-apr
Parameters:
  - window: '30d' (default)
  - limit: 20 (default)
  - min_volume: 10000 (default)
```

#### Trader Profile
```
GET /api/traders/profile/{address}
Parameters:
  - window: '30d' (default)
```

### 4. **Python Trading Analytics Module**

#### TraderSearch Class (`polycopy/traders.py`)
Comprehensive trader analysis toolkit:

**Methods**:
- `leaderboard()`: Get ranked trader list with filters
- `find_top_apr_traders()`: Find highest annualized returns
- `trader_profile()`: Detailed trader profile with positions/trades
- `compare_traders()`: Side-by-side comparison
- `search_by_criteria()`: Advanced multi-criteria search

**Calculated Metrics**:
- **ROI**: (PnL / Volume) × 100
- **APR**: Annualized return based on time window
- **Sharpe Ratio**: Risk-adjusted return estimate
- **Profit Factor**: (PnL + Volume) / Volume

**Interactive CLI** (`interactive_trader_selection()`):
- Browse traders by APR, volume, or PnL
- Custom search criteria
- Direct address lookup
- Detailed profile views
- Multi-selection support

## Usage Examples

### Web Interface
1. Navigate to Polycopy app (http://localhost:3000)
2. Click "Discover" tab
3. Set filters:
   - Time Window: "Last 30 Days"
   - Sort By: "APR"
   - Min Volume: "10000"
   - Min APR: "50"
4. Click "Search Traders"
5. Select traders by clicking checkboxes or "Details" for in-depth analysis
6. Click "Add to Monitor" to start copying their trades

### Python CLI
```python
from polycopy.traders import TraderSearch, interactive_trader_selection

# Quick search
search = TraderSearch()
traders = search.leaderboard(window='30d', min_volume=10000, sort_by='apr')

# Interactive browser
selected = interactive_trader_selection(
    window='30d',
    min_volume=10000,
    min_apr=50,
    limit=20
)

# Get detailed profile
profile = search.trader_profile('0xADDRESS', window='30d')
```

### Command Line
```bash
# Search top APR traders
python search.py --window 30d --min-apr 50 --min-volume 10000 --limit 20

# Get trader profile
python search.py --profile 0xADDRESS --window 30d

# Compare multiple traders
python search.py --compare 0xADDR1 0xADDR2 0xADDR3 --window 30d
```

## Data Flow

```
Polymarket Data API
        ↓
TraderSearch Class (traders.py)
        ↓
FastAPI Server (server/api.py)
        ↓
Next.js Frontend (TraderDiscovery.tsx)
        ↓
User Interface
```

## Key Features

✅ **Real-time Data**: Fetches live leaderboard data from Polymarket
✅ **Advanced Filtering**: Multiple criteria for finding the best traders
✅ **Risk Metrics**: Sharpe ratio and profit factor calculations
✅ **Detailed Analytics**: Complete trader profiles with positions and trades
✅ **Bulk Operations**: Select and monitor multiple traders at once
✅ **Responsive UI**: Works on desktop and mobile
✅ **Color-coded P&L**: Visual indicators for profits (green) and losses (red)
✅ **API Caching**: Endpoint caching for faster subsequent requests

## Performance Metrics Explained

- **PnL (Profit & Loss)**: Net earnings after all trades
- **Volume**: Total USD traded across all markets
- **ROI (Return on Investment)**: Profit as percentage of volume
- **APR (Annual Percentage Rate)**: ROI annualized to yearly basis
- **Sharpe Ratio**: Risk-adjusted returns (higher is better)
- **Profit Factor**: Ratio indicating overall profitability

## Color Coding

- 🟢 **Green**: Positive PnL, ROI, or APR ≥ 100%
- 🟡 **Yellow**: APR between 50-100%
- 🔴 **Red**: Negative PnL or ROI
- ⚪ **White**: Neutral metrics (Volume, Sharpe)

## Future Enhancements

Potential additions:
- [ ] Historical performance charts
- [ ] Win rate calculations
- [ ] Market-specific trader rankings
- [ ] Trader comparison tool
- [ ] Position size recommendations
- [ ] Risk score calculations
- [ ] Profit/loss trend graphs
- [ ] Export trader data to CSV
- [ ] Watchlist/favorites feature
- [ ] Email alerts for top traders

## Technical Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: FastAPI, Python 3.11+
- **Data Source**: Polymarket Data API
- **Icons**: Lucide React
- **Notifications**: React Toastify

## Files Modified/Created

1. `polycopy/app/components/TraderDiscovery.tsx` - Enhanced with profile modal
2. `polycopy/traders.py` - Comprehensive trader search module
3. `polycopy/search.py` - CLI search tool
4. `polycopy/server/api.py` - API endpoints for trader search
5. `polycopy/app/app/page.tsx` - Main app with Discover tab

## API Status

All trader search endpoints are live and accessible at:
- http://localhost:8001/api/traders/search
- http://localhost:8001/api/traders/top-apr
- http://localhost:8001/api/traders/profile/{address}
