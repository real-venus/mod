# Roadmap

01/09 (finalization setup) 
- app and backend progress
- user can create modules, edit modules and fork modules
-  metamask and subwallet is supported for users to bridge from the old balance sheet 
- compute requirements will be 3-5 cpu heavy machiens (still in the progress of aquiring)
- users can browse existing modules
- users can create modules from github
- smart contracts ready for deployment (not yet deployed on testnet are being deployed on local network (ganache))
    - registry (registration of modules)
    - revenue model for subscription 
    - treasury 
        - 50% of treasury can be withdrawn by veMod 
        - 50% of treasury is accessed to the owner (SAFE multisig)
    

01/16 (foundation finalization)

On Testnet

- aqauire compute for app
- enable bridge from substrate to modtoken (on testnet)
- registry v0 is running with app and users can register through the app and through using bloctime as collateral
- usMOD will accept 1 to 1 conversion from usdt and usdc 
- bloctime Staking enabled with erc20 (MOD)
- subscription model of 10 usMOD a month 

Audits #1


01/23 (mcp and x402 integrations)
- safe multisig will be setup to handle all of the ownership of the smarcontracts
- mcp support enabled
- x402 support enabled where 
- add 10 mcp servers (this is straight forward as it should be as simple)
- start including 

Audits #2
- audit round #1 run by prime dev and 
- AIs will also participate in the audits (multiple ais will be used to suggest feature issues)

01/30 (privacy)

- graph navigation of modules to represent trees
- allow users to encrypt modules before posting them on chain for privacy
- add 10 more mcp servers (find 10 github urls that are mcp compatible)

Audits #3
    - week is full spent with audits
    - will find +1/+2 devs to help audit smart contracts and code 


02/06 (Production-Ready Testnet; Final Audit Path)
    - add 10 more mcp servers (find 10 github urls that are mcp compatible)
    - final audits to ensure everything is running smoothly

02/13 (Launch)
    - set multisig to mainnet
    - deploy smart contracts 
    - open bridge for people to start claiming on mainnet




# Appendix

# Priority Modules

These modules are of priority of being deployed post foundation

## Model Providers
- **openrouter** (priority) - Multi-model API aggregator for flexible AI access
- **anthropic** - Claude models for advanced reasoning
- **openai** - GPT models for general-purpose tasks
- **chutes** - Specialized model deployment

## Compute Infrastructure
- **primeintellect** (priority) - Decentralized GPU compute network
- **akash** - Decentralized cloud computing marketplace
- **lium** (bittensor) - Incentivized machine learning network

## DeFi Integration

### Price Feeds
- **uniswap** (priority) - DEX liquidity and pricing data
- **raydium** (priority) - Solana-based AMM pricing
- **coingecko** (priority) - Comprehensive market data aggregator
- **coinmarketcap** (priority) - Industry-standard price tracking
- **binance** - CEX pricing and volume data

### Oracle Services
- **chainlink** - Decentralized oracle network for reliable data feeds
- **pyth** - High-frequency price oracle for DeFi

### Lending Protocols
- **aave** - Leading decentralized lending platform
- **gnosis** - Multi-sig and DAO treasury management

### Low-Risk Stablecoin Yield (1-10% ROI)
- **aave** - Stable yield through overcollateralized lending

## Implementation Strategy
1. Prioritize integrations marked as (priority)
2. Build modular connectors for each service
3. Implement robust error handling and fallback mechanisms
4. Monitor performance and optimize based on usage patterns
