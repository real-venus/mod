#!/usr/bin/env python3
"""
Quick demo of config.json IPFS feature for commune registration.
"""

import sys
sys.path.insert(0, '.')

from claude.claude import Mod


def main():
    print("\n" + "="*70)
    print("CLAUDE CONFIG.JSON + IPFS DEMO")
    print("="*70 + "\n")

    # 1. Initialize (auto-creates config if needed)
    print("📦 Initializing Claude module...")
    c = Mod()
    print("✓ Initialized\n")

    # 2. Show current config
    print("📋 Current configuration:")
    c.show_config()

    # 3. Get CID
    print("\n📍 Getting config CID...")
    cid = c.get_config_cid()
    if cid:
        print(f"✓ Config CID: {cid}")
        print(f"  Gateway: https://ipfs.io/ipfs/{cid}")
    else:
        print("⚠ No CID yet (IPFS may not be running)")
        print("  Config created locally at ./config.json")

    # 4. Show what the config contains
    print("\n" + "="*70)
    print("CONFIG CONTENTS FOR COMMUNE REGISTRATION")
    print("="*70 + "\n")

    import json
    import os

    config_path = os.path.join(os.path.dirname(__file__), 'config.json')
    with open(config_path, 'r') as f:
        config = json.load(f)

    print(f"Module Name:   {config['name']}")
    print(f"Version:       {config['version']}")
    print(f"Description:   {config['description'][:60]}...")
    print(f"\nService URLs:")
    print(f"  App:  {config['urls']['app']}")
    print(f"  API:  {config['urls']['api']}")
    print(f"\nExposed Functions: {len(config['fns'])}")
    for fn in config['fns'][:5]:
        print(f"  - {fn}")
    print(f"  ... and {len(config['fns']) - 5} more")
    print(f"\nAPI Endpoints: {len(config['endpoints'])}")
    for endpoint in list(config['endpoints'].keys())[:3]:
        print(f"  - {endpoint}: {config['endpoints'][endpoint]}")
    print(f"  ... and {len(config['endpoints']) - 3} more")

    # 5. Next steps
    print("\n" + "="*70)
    print("NEXT STEPS")
    print("="*70 + "\n")

    print("""
1. For production deployment, update URLs:

   cid = c.update_config_urls(
       app_url="https://claude.yourapp.com",
       api_url="https://api.yourapp.com"
   )

2. Register with commune on-chain:

   import mod as m
   commune = m.mod('commune')()
   commune.register_module(
       name='claude',
       cid=cid,
       key=m.key()
   )

3. Your module is now discoverable on commune! 🎉
    """)

    print("="*70 + "\n")
    print("✓ Demo complete!")
    print("\nSee examples/commune_registration.py for full example")
    print("See COMMUNE_REGISTRATION.md for complete guide\n")


if __name__ == '__main__':
    main()
