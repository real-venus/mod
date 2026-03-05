# Quick Start: Trader Search & P/L Analysis

## 🚀 Getting Started

### Step 1: Launch the Application

```bash
cd ~/mod/mod/orbit/polycopy
npm run dev --prefix polycopy/app        # Start frontend (port 3000)
python polycopy/server/api.py            # Start backend (port 8001)
```

Or using PM2:
```bash
./start.sh
```

### Step 2: Open the Web Interface

Navigate to: **http://localhost:3000**

The app will open on the **Discover** tab by default.

---

## 🔍 Finding Profitable Traders

### Basic Search

1. **Set Time Window**
   - Choose: `Last 7 Days`, `Last 30 Days`, or `All Time`
   - Default: `Last 30 Days`

2. **Choose Sort Criteria**
   - `APR (Annualized Return)` - Best for long-term profitability
   - `Profit & Loss` - Raw earnings
   - `Volume` - Most active traders
   - `ROI` - Efficiency of capital use

3. **Apply Filters** (Optional)
   ```
   Min Volume: 10000      # Filter out low-volume traders
   Min APR: 50            # Only show traders with 50%+ yearly returns
   ```

4. **Click "Search Traders"**

---

## 📊 Understanding the Results

The trader list shows:

| Column | Description | Color Code |
|--------|-------------|------------|
| **Select** | Checkbox to select trader | - |
| **Address** | Trader's wallet address | - |
| **PnL** | Total Profit/Loss | 🟢 Profit / 🔴 Loss |
| **Volume** | Total trading volume | - |
| **ROI** | Return on Investment % | 🟢 Positive / 🔴 Negative |
| **APR** | Annualized return % | 🟢 >100% / 🟡 50-100% |
| **Sharpe** | Risk-adjusted returns | - |
| **Actions** | View details button | - |

---

## 👁️ View Detailed Trader Profile

Click the **"Details"** button on any trader to see:

### Performance Metrics
- **Profit & Loss**: Total earnings
- **Volume**: Total traded
- **ROI**: Return percentage
- **APR**: Yearly return rate

### Trading Activity
- **Leaderboard Rank**: Global ranking
- **Total Trades**: Number of trades
- **Active Positions**: Currently open
- **Portfolio Value**: Total position value

### Current Positions
- Market questions
- Yes/No outcomes
- Position sizes
- Current values

### Recent Trades
- Buy/Sell actions
- Market names
- Trade prices
- Quantities

### Quick Actions
- **Add to Monitor**: Start copying this trader
- **Close**: Return to search

---

## ✅ Adding Traders to Monitor

### Method 1: Single Trader
1. Click **"Details"** on a trader
2. Review their profile
3. Click **"Add to Monitor"**
4. You'll be switched to the Monitor tab

### Method 2: Bulk Selection
1. Click checkboxes on multiple traders
2. Yellow banner appears showing selection count
3. Click **"Add to Monitor"** in the banner
4. All selected traders added at once

---

## 🎯 Example Search Scenarios

### Find Conservative Traders
```
Time Window: Last 30 Days
Sort By: Sharpe
Min Volume: 50000
Min APR: 30
```

### Find Aggressive High-Reward Traders
```
Time Window: Last 7 Days
Sort By: APR
Min Volume: 10000
Min APR: 100
```

### Find High-Volume Professionals
```
Time Window: All Time
Sort By: Volume
Min Volume: 100000
```

---

## 📈 Key Metrics Explained

### PnL (Profit & Loss)
- **What it is**: Net earnings after all trades
- **Good value**: > $1,000
- **Great value**: > $10,000

### Volume
- **What it is**: Total USD traded
- **Why it matters**: Shows trader activity and consistency
- **Good value**: > $50,000

### ROI (Return on Investment)
- **What it is**: (Profit / Volume) × 100
- **Good value**: > 20%
- **Great value**: > 50%

### APR (Annual Percentage Rate)
- **What it is**: ROI annualized to yearly basis
- **Good value**: > 50%
- **Great value**: > 100%
- **Amazing value**: > 200%

### Sharpe Ratio
- **What it is**: Risk-adjusted returns
- **Good value**: > 1.0
- **Great value**: > 2.0

---

## ⚠️ Important Notes

### Data Refresh
- Leaderboard data updates in real-time
- Click "Search Traders" to refresh results
- Profile data is fetched on-demand

### API Connection
- Check the header for API status indicator
- 🟢 Green = Connected
- 🔴 Red = Disconnected
- If disconnected, backend may not be running

### Performance Tips
1. Use narrower time windows (7d vs All Time) for faster results
2. Set minimum volume filter to reduce noise
3. Limit results to 20-50 traders for faster loading

---

## 🔧 Troubleshooting

### No Traders Found
- Check internet connection
- Reduce filter strictness (lower Min APR/Volume)
- Try different time window
- Verify backend is running: http://localhost:8001/api/health

### Profile Won't Load
- Check API connection status in header
- Try refreshing the page
- Verify address is valid

### Can't Add to Monitor
- Ensure at least one trader is selected
- Check that API is connected
- Try adding one trader at a time

---

## 📱 Mobile Access

The interface is fully responsive and works on:
- Desktop browsers (Chrome, Firefox, Safari, Edge)
- Tablets (iPad, Android tablets)
- Mobile phones (iOS, Android)

---

## 🎨 UI Color Guide

- 🟢 **Green**: Profits, positive returns, high APR
- 🟡 **Yellow**: Moderate APR (50-100%)
- 🔴 **Red**: Losses, negative returns
- 🔵 **Blue**: Actions, links, highlights
- ⚪ **White/Gray**: Neutral metrics

---

## 🚦 Next Steps

1. **Search for traders** using the criteria above
2. **Analyze profiles** to understand their trading style
3. **Select traders** with consistent positive metrics
4. **Add to monitor** to start copy trading
5. **Switch to Monitor tab** to configure settings
6. **Start monitoring** and let the bot copy their trades

---

## 💡 Pro Tips

1. **Diversify**: Don't copy just one trader - spread risk
2. **Check history**: Look at positions and recent trades
3. **Start with dry run**: Test with simulation first
4. **Set limits**: Use max trade size to control risk
5. **Monitor performance**: Regularly check the Stats tab

---

## 📚 Related Documentation

- [TRADER_SEARCH_FEATURE.md](./TRADER_SEARCH_FEATURE.md) - Technical details
- [README.md](./README.md) - Full project documentation
- [TRADER_BROWSER.md](./TRADER_BROWSER.md) - CLI browser guide

---

**Happy Trading! 📈💰**
