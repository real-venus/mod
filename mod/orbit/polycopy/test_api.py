#!/usr/bin/env python3
"""
Quick API endpoint tester for Polymarket

Use this to diagnose which API endpoints work for a given trader address.
"""

import sys
sys.path.insert(0, '/Users/broski/mod/mod/core')

import mod as m


def test_address(address: str):
    """Test API endpoints for a specific address"""
    print(f"\n🔍 Testing Polymarket API Endpoints")
    print(f"Address: {address}\n")

    polycopy = m.mod('polycopy')()
    results = polycopy.test_api(address)

    # Summary
    print("\n📊 Summary:")
    print("-" * 80)

    working_positions = [name for name, data in results['positions'].items() if data.get('working')]
    working_trades = [name for name, data in results['trades'].items() if data.get('working')]

    print(f"✅ Working Position Endpoints: {len(working_positions)}/{len(results['positions'])}")
    for name in working_positions:
        count = results['positions'][name].get('count', 0)
        print(f"   • {name}: {count} positions")

    print(f"\n✅ Working Trade Endpoints: {len(working_trades)}/{len(results['trades'])}")
    for name in working_trades:
        count = results['trades'][name].get('count', 0)
        print(f"   • {name}: {count} trades")

    if not working_positions and not working_trades:
        print("\n⚠️  Warning: No working endpoints found!")
        print("   This address may be inactive or the API structure has changed.")
        print("   Try a known active trader address from the leaderboard.")

    print()


if __name__ == '__main__':
    # Default test address (from the error log)
    test_addr = '0x916f7165c2c836aba22edb6453cdbb5f3ea253ba'

    # Allow custom address via command line
    if len(sys.argv) > 1:
        test_addr = sys.argv[1]

    test_address(test_addr)
