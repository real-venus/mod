#!/usr/bin/env python3
"""
Polycopy Example Usage

This script demonstrates the polycopy SDK for Polymarket copy trading.
"""

import mod as m

def example_1_monitor_only():
    """Example 1: Just check status of an address without trading"""
    print("\n" + "="*60)
    print("Example 1: Monitor Only")
    print("="*60)

    polycopy = m.mod('polycopy')()
    status = polycopy.forward(
        addresses='0x0000000000000000000000000000000000000000',  # Replace with real address
        mode='monitor'
    )
    print(status)


def example_2_single_dry_run():
    """Example 2: Copy trade ONE address in dry-run mode"""
    print("\n" + "="*60)
    print("Example 2: Single Address - Dry Run")
    print("="*60)

    polycopy = m.mod('polycopy')()

    # This will simulate copying trades without executing
    result = polycopy.forward(
        addresses='0x0000000000000000000000000000000000000000',  # Replace with real address
        mode='copy',
        dry_run=True,           # Safe mode - no real trades
        multiplier=0.5,         # Copy at 50% of their size
        poll_interval=30,       # Check every 30 seconds
        max_trade_size=100      # Max $100 per trade
    )
    print(result)


def example_3_parallel_dry_run():
    """Example 3: Copy trade MULTIPLE addresses in parallel (dry-run)"""
    print("\n" + "="*60)
    print("Example 3: Multiple Addresses - Parallel Dry Run")
    print("="*60)

    polycopy = m.mod('polycopy')()

    # Monitor 3 addresses in parallel
    addresses = [
        '0x0000000000000000000000000000000000000001',  # Replace with real addresses
        '0x0000000000000000000000000000000000000002',
        '0x0000000000000000000000000000000000000003'
    ]

    result = polycopy.forward(
        addresses=addresses,
        mode='copy',
        dry_run=True,
        multiplier=0.2,         # 20% of their size
        poll_interval=30
    )
    print(result)

    # Let it run for a bit, then check stats
    # import time
    # time.sleep(120)  # Run for 2 minutes
    # print("\nStats:", polycopy.stats())
    # polycopy.stop()


def example_4_live_trading():
    """Example 4: LIVE TRADING (use with caution!)"""
    print("\n" + "="*60)
    print("Example 4: LIVE TRADING - Use with Caution!")
    print("="*60)

    # IMPORTANT: Only uncomment when you're ready for live trading!
    print("COMMENTED OUT FOR SAFETY")
    print("Uncomment and set proper private_key and addresses")

    # polycopy = m.mod('polycopy')()
    # result = polycopy.forward(
    #     addresses='0xRealWhaleAddress...',
    #     mode='copy',
    #     dry_run=False,          # LIVE MODE
    #     private_key='your_private_key',  # or use m.key()
    #     multiplier=0.1,         # Start conservative - 10% of their size
    #     max_trade_size=50,      # Small trades to start
    #     max_position_size=200,
    #     risk_limits={
    #         'max_daily_trades': 10,
    #         'max_daily_volume': 500.0,
    #         'max_concurrent_positions': 5
    #     }
    # )


def example_5_server_mode():
    """Example 5: Run as continuous server"""
    print("\n" + "="*60)
    print("Example 5: Server Mode (24/7 monitoring)")
    print("="*60)

    print("To run as server, use:")
    print("")
    print("  m.serve('polycopy',")
    print("      addresses=['0xAddress1...', '0xAddress2...'],")
    print("      mode='server',")
    print("      dry_run=True)")
    print("")
    print("Check stats: m.fn('polycopy/stats')()")
    print("Stop server: m.kill('polycopy')")


if __name__ == '__main__':
    print("\nPolycopy SDK Examples")
    print("=====================\n")
    print("Choose an example to run:")
    print("1. Monitor only (just check status)")
    print("2. Single address dry-run")
    print("3. Multiple addresses parallel dry-run")
    print("4. Live trading (CAUTION!)")
    print("5. Server mode info")

    choice = input("\nEnter choice (1-5): ").strip()

    if choice == '1':
        example_1_monitor_only()
    elif choice == '2':
        example_2_single_dry_run()
    elif choice == '3':
        example_3_parallel_dry_run()
    elif choice == '4':
        example_4_live_trading()
    elif choice == '5':
        example_5_server_mode()
    else:
        print("Invalid choice!")
