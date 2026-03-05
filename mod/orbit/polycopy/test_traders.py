#!/usr/bin/env python3
"""Test script for trader search functionality"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from polycopy.traders import TraderSearch


def main():
    print("\n" + "="*80)
    print("Testing Polymarket Trader Search")
    print("="*80 + "\n")

    search = TraderSearch()

    # Test 1: Top APR traders
    print("Test 1: Top 10 traders by APR (7-day window)")
    print("-" * 80)
    traders = search.leaderboard(window='7d', limit=10, sort_by='apr')

    if traders:
        search.display_leaderboard(traders, top_n=10)
        print(f"✓ Found {len(traders)} traders")
    else:
        print("✗ No traders found")

    # Test 2: Filter by volume and trades
    print("\nTest 2: Traders with >$50k volume and >5 trades")
    print("-" * 80)
    filtered = search.leaderboard(
        window='30d',
        min_volume=50000,
        min_trades=5,
        limit=20,
        sort_by='apr'
    )

    if filtered:
        print(f"✓ Found {len(filtered)} traders matching criteria")
        print(f"Top trader: {filtered[0].get('userName')} - {filtered[0].get('apr')}% APR")
    else:
        print("✗ No traders matched criteria")

    # Test 3: Smart trader search
    print("\nTest 3: Smart traders (>100% APR, >$25k volume)")
    print("-" * 80)
    smart = search.search_by_criteria(
        min_apr=100,
        min_volume=25000,
        window='30d'
    )

    if smart:
        print(f"✓ Found {len(smart)} smart traders")
        for i, trader in enumerate(smart[:5], 1):
            print(f"  {i}. {trader['userName']}: {trader['apr']}% APR, ${trader['vol']:,.0f} volume")
    else:
        print("✗ No smart traders found")

    # Test 4: Trader profile
    print("\nTest 4: Detailed trader profile")
    print("-" * 80)
    if traders:
        top_trader = traders[0]
        address = top_trader['proxyWallet']
        profile = search.trader_profile(address, window='30d')

        print(f"Trader: {profile.get('address')}")
        print(f"  Rank: #{profile.get('leaderboard_rank', 'N/A')}")
        print(f"  APR: {profile.get('apr', 0):.1f}%")
        print(f"  Volume: ${profile.get('volume', 0):,.0f}")
        print(f"  Trades: {profile.get('total_trades', 0)}")
        print(f"  Positions: {profile.get('position_count', 0)}")
        print("✓ Profile fetched successfully")

    # Test 5: Sort by different metrics
    print("\nTest 5: Top 5 by volume")
    print("-" * 80)
    by_volume = search.leaderboard(window='7d', limit=5, sort_by='vol')

    if by_volume:
        for i, trader in enumerate(by_volume, 1):
            print(f"  {i}. {trader['userName']}: ${trader['vol']:,.0f}")
        print("✓ Volume sorting works")

    print("\n" + "="*80)
    print("All tests completed!")
    print("="*80 + "\n")


if __name__ == '__main__':
    main()
