#!/usr/bin/env python3
"""
Example: Interactive Trader Browser

Run this to browse and select Polymarket traders to copy trade.
No need to manually paste addresses!
"""

import sys
sys.path.insert(0, '/Users/broski/mod/mod/core')

import mod as m


def main():
    print("\n🚀 Polycopy Interactive Trader Browser Example\n")

    # Initialize polycopy module
    polycopy = m.mod('polycopy')()

    # Option 1: Default browse - discover and auto-start copy trading
    print("Example 1: Launch interactive browser (default settings)")
    print("-" * 60)
    result = polycopy.browse()
    print(f"\nResult: {result}\n")


    # Option 2: Custom filters - find high-APR traders only
    print("\nExample 2: Browse with custom filters (min 100% APR, $50k+ volume)")
    print("-" * 60)
    result = polycopy.browse(
        window='30d',
        min_apr=100,
        min_volume=50000,
        limit=20,
        auto_start=False  # Just select, don't auto-start
    )
    print(f"\nResult: {result}\n")


    # Option 3: Quick programmatic search (no interactive menu)
    print("\nExample 3: Quick top APR lookup (programmatic)")
    print("-" * 60)
    top_traders = polycopy.top_apr(window='7d', limit=10, min_volume=10000)

    if top_traders:
        print(f"\nFound {len(top_traders)} top traders:")
        for i, trader in enumerate(top_traders[:5], 1):
            print(f"  {i}. {trader.get('userName', 'Anonymous')[:20]:<20} | APR: {trader['apr']:>7.1f}% | Vol: ${trader['vol']:>12,.0f}")

        # Auto-select the top trader
        best = top_traders[0]
        print(f"\n✅ Auto-selecting top trader: {best.get('userName', 'Anonymous')}")
        print(f"   Address: {best['proxyWallet']}")
        print(f"   APR: {best['apr']:.1f}%")

        # Start copy trading
        polycopy.forward(
            addresses=best['proxyWallet'],
            dry_run=True,  # SAFE - just simulate
            multiplier=0.5,
            poll_interval=30
        )


    # Option 4: Search smart traders and compare
    print("\nExample 4: Find and compare elite traders")
    print("-" * 60)
    elite = polycopy.search_smart_traders(
        min_apr=150,
        min_volume=100000,
        min_trades=15,
        window='30d',
        display=False
    )

    if elite and len(elite) >= 2:
        print(f"\nFound {len(elite)} elite traders")

        # Compare top 3
        top_3_addresses = [t['proxyWallet'] for t in elite[:3]]
        comparison = polycopy.compare_traders(top_3_addresses, window='30d')

        print(f"\nComparison of top 3:")
        for i, trader in enumerate(comparison['traders'], 1):
            print(f"  {i}. APR: {trader['apr']:>7.1f}% | Vol: ${trader['volume']:>12,.0f} | Positions: {trader['position_count']}")


if __name__ == '__main__':
    main()
