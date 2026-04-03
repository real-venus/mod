#!/usr/bin/env python3
"""
Commune On-Chain Registration Example

This example demonstrates how to:
1. Get the config.json IPFS CID for commune registration
2. Update app/API URLs when deploying to production
3. Register the module on-chain using the CID

The config.json contains all module metadata including:
- Module name, version, description
- App URL (Next.js frontend)
- API URL (Rust backend)
- Available functions
- API endpoints

This CID is stored to IPFS and can be registered with commune,
making the module discoverable and accessible on-chain.
"""

import sys
sys.path.insert(0, '..')

from claude import Mod


def main():
    print("\n" + "="*60)
    print("COMMUNE ON-CHAIN REGISTRATION")
    print("="*60 + "\n")

    # Initialize Claude module
    c = Mod()

    # 1. Show current config
    print("📋 Current configuration:")
    c.show_config()

    # 2. Get config CID for registration
    cid = c.get_config_cid()
    if cid:
        print(f"\n✓ Config CID ready for commune registration: {cid}")
    else:
        print("\n⚠ Config not yet stored to IPFS")
        print("  It will be automatically stored on first initialization")

    # 3. Update URLs for production deployment (optional)
    print("\n" + "="*60)
    print("UPDATING URLs FOR PRODUCTION")
    print("="*60 + "\n")

    # Uncomment to update URLs:
    # new_cid = c.update_config_urls(
    #     app_url="https://claude.yourapp.com",
    #     api_url="https://api.yourapp.com"
    # )
    # print(f"\n✓ Updated CID: {new_cid}")

    # 4. How to register with commune (pseudo-code)
    print("\n" + "="*60)
    print("NEXT STEPS: REGISTER WITH COMMUNE")
    print("="*60 + "\n")

    print("""
To register this module with commune on-chain:

```python
import mod as m

# Get the config CID
claude = m.mod('claude')()
cid = claude.get_config_cid()

# Register on-chain using commune
commune = m.mod('commune')()
tx = commune.register_module(
    name='claude',
    cid=cid,
    key=m.key()  # Your wallet key
)

print(f"Registered! Transaction: {tx}")
```

The CID points to the immutable config.json on IPFS containing:
- Module metadata (name, version, description)
- Service URLs (app frontend, API backend)
- Available functions and endpoints
- All info needed for on-chain discoverability
    """)

    print("="*60 + "\n")


if __name__ == '__main__':
    main()
