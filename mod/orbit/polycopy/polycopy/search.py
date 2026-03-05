#!/usr/bin/env python3
"""
CLI tool for searching Polymarket traders

Usage:
    python search.py --window 7d --limit 20 --min-apr 50
    python search.py --sort vol --min-volume 100000
    python search.py --profile 0xc257ea7e3a81ca8e16df8935d44d513959fa358e
"""

import argparse
from traders import TraderSearch


def main():
    parser = argparse.ArgumentParser(description='Search Polymarket traders by performance')

    # Search mode
    parser.add_argument('--profile', type=str, help='Get detailed profile for specific address')
    parser.add_argument('--compare', nargs='+', help='Compare multiple addresses')

    # Filters
    parser.add_argument('--window', type=str, default='30d',
                       choices=['1d', '7d', '30d', 'all'],
                       help='Time window (default: 30d)')
    parser.add_argument('--limit', type=int, default=20,
                       help='Number of results (default: 20)')
    parser.add_argument('--min-volume', type=float, default=0,
                       help='Minimum trading volume')
    parser.add_argument('--min-pnl', type=float, default=None,
                       help='Minimum profit/loss')
    parser.add_argument('--min-trades', type=int, default=0,
                       help='Minimum number of trades')
    parser.add_argument('--min-apr', type=float, default=None,
                       help='Minimum APR percentage')
    parser.add_argument('--min-roi', type=float, default=None,
                       help='Minimum ROI percentage')

    # Sorting
    parser.add_argument('--sort', type=str, default='apr',
                       choices=['pnl', 'vol', 'roi', 'apr', 'sharpe'],
                       help='Sort by metric (default: apr)')

    # Output
    parser.add_argument('--json', action='store_true',
                       help='Output as JSON instead of table')

    args = parser.parse_args()

    search = TraderSearch()

    # Profile mode
    if args.profile:
        profile = search.trader_profile(args.profile, args.window)
        if args.json:
            import json
            print(json.dumps(profile, indent=2))
        else:
            print_profile(profile)
        return

    # Compare mode
    if args.compare:
        comparison = search.compare_traders(args.compare, args.window)
        if args.json:
            import json
            print(json.dumps(comparison, indent=2))
        else:
            print_comparison(comparison)
        return

    # Search mode
    traders = search.leaderboard(
        window=args.window,
        limit=args.limit,
        min_volume=args.min_volume,
        min_pnl=args.min_pnl,
        min_trades=args.min_trades,
        min_roi=args.min_roi,
        sort_by=args.sort
    )

    # Filter by APR if specified
    if args.min_apr is not None:
        traders = [t for t in traders if t.get('apr', 0) >= args.min_apr]

    if args.json:
        import json
        print(json.dumps(traders, indent=2))
    else:
        search.display_leaderboard(traders, args.limit)


def print_profile(profile: dict):
    """Print trader profile in formatted style"""
    print(f"\n{'='*80}")
    print(f"Trader Profile: {profile['address']}")
    print(f"{'='*80}")

    print(f"\nLeaderboard Stats:")
    print(f"  Rank:           #{profile.get('leaderboard_rank', 'N/A')}")
    print(f"  Volume:         ${profile.get('volume', 0):,.2f}")
    print(f"  PnL:            ${profile.get('pnl', 0):,.2f}")
    print(f"  ROI:            {profile.get('roi', 0):.2f}%")
    print(f"  APR:            {profile.get('apr', 0):.2f}%")

    print(f"\nActivity:")
    print(f"  Total Trades:   {profile.get('total_trades', 0)}")
    print(f"  Positions:      {profile.get('position_count', 0)}")
    print(f"  Total Value:    ${profile.get('total_value', '0')}")

    if profile.get('recent_trades'):
        print(f"\nRecent Trades:")
        for i, trade in enumerate(profile['recent_trades'][:5], 1):
            side = trade.get('side', 'unknown')
            qty = trade.get('quantity', '0')
            price = trade.get('price', '0')
            market = trade.get('market', {}).get('question', 'Unknown')[:50]
            print(f"  {i}. {side.upper():<4} {qty:<10} @ ${price:<8} - {market}")

    print(f"\n{'='*80}\n")


def print_comparison(comparison: dict):
    """Print trader comparison"""
    print(f"\n{'='*80}")
    print(f"Trader Comparison - {comparison['window']} window")
    print(f"{'='*80}\n")

    for i, trader in enumerate(comparison['traders'], 1):
        print(f"{i}. {trader['address']}")
        print(f"   Rank: #{trader.get('leaderboard_rank', 'N/A')}")
        print(f"   APR: {trader.get('apr', 0):.1f}% | ROI: {trader.get('roi', 0):.1f}%")
        print(f"   Volume: ${trader.get('volume', 0):,.0f} | PnL: ${trader.get('pnl', 0):,.0f}")
        print(f"   Trades: {trader.get('total_trades', 0)} | Positions: {trader.get('position_count', 0)}")
        print()

    print(f"{'='*80}\n")


if __name__ == '__main__':
    main()
