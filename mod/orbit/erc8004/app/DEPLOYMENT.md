# Deployment Guide

## Prerequisites

1. **Contract Addresses**: You need the deployed addresses of:
   - Identity Registry contract
   - Reputation Registry contract
   - Validation Registry contract

2. **Network Configuration**: Decide which network(s) to support:
   - Ethereum Mainnet (chainId: 1)
   - Sepolia Testnet (chainId: 11155111)
   - Base Sepolia (chainId: 84532)

## Configuration Steps

### 1. Update Contract Addresses

Edit `lib/config.ts` and replace the placeholder addresses:

```typescript
export const CHAIN_CONFIG = {
  mainnet: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    contracts: {
      identityRegistry: '0xYOUR_IDENTITY_CONTRACT',
      reputationRegistry: '0xYOUR_REPUTATION_CONTRACT',
      validationRegistry: '0xYOUR_VALIDATION_CONTRACT',
    },
  },
  // ... update other networks
};
```

### 2. Environment Variables (Optional)

Create `.env.local`:

```bash
# Contract Addresses
NEXT_PUBLIC_IDENTITY_REGISTRY=0xYOUR_ADDRESS
NEXT_PUBLIC_REPUTATION_REGISTRY=0xYOUR_ADDRESS
NEXT_PUBLIC_VALIDATION_REGISTRY=0xYOUR_ADDRESS

# Network
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_NETWORK_NAME=mainnet
```

### 3. Update Default Chain

In `lib/config.ts`, set the default chain:

```typescript
export const DEFAULT_CHAIN = 'mainnet'; // or 'sepolia', 'baseSepolia'
```

## Deployment Options

### Option 1: Vercel (Recommended)

Vercel is the easiest way to deploy Next.js applications.

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

**Environment Variables in Vercel:**
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add your contract addresses
4. Redeploy

### Option 2: Docker

Build and run with Docker:

```bash
# Build the image
docker build -t erc8004-frontend -f app/Dockerfile .

# Run the container
docker run -p 3000:3000 erc8004-frontend

# Or use docker-compose
docker-compose up --build
```

### Option 3: Traditional Hosting

Build the static site:

```bash
# Install dependencies
npm install

# Build for production
npm run build

# The output is in .next/ folder
# You can serve it with:
npm start

# Or export static HTML (if using static export)
npm run build && npm run export
```

Deploy the `.next` folder to:
- AWS (Amplify, S3 + CloudFront)
- Google Cloud Platform
- Azure
- Netlify
- Railway
- Render
- DigitalOcean

## Post-Deployment Checklist

- [ ] Verify contract addresses are correct
- [ ] Test wallet connection
- [ ] Test agent registration
- [ ] Test reputation submission
- [ ] Test validation proofs
- [ ] Verify all networks are working
- [ ] Check mobile responsiveness
- [ ] Test dark mode
- [ ] Monitor for errors in production
- [ ] Set up analytics (optional)
- [ ] Configure custom domain (optional)

## Troubleshooting

### Issue: "No Ethereum wallet detected"
- Ensure MetaMask or another Web3 wallet is installed
- Check if the browser supports `window.ethereum`

### Issue: "Wrong network"
- Make sure the wallet is connected to the correct network
- The app will prompt to switch networks if needed

### Issue: "Transaction failed"
- Check gas prices and wallet balance
- Verify contract addresses are correct
- Ensure contracts are deployed on the network
- Check contract ABIs match deployment

### Issue: "Cannot read metadata"
- Verify metadata URI format is correct
- If using IPFS, ensure gateway is accessible
- Check base64 encoding for inline metadata

## Security Considerations

1. **Never expose private keys**
   - Use environment variables for sensitive data
   - Add `.env.local` to `.gitignore`

2. **Verify contracts before mainnet**
   - Test thoroughly on testnet
   - Audit smart contracts
   - Use established security patterns

3. **Rate limiting**
   - Consider adding rate limiting for API calls
   - Prevent spam registrations if needed

4. **Input validation**
   - Frontend validates all user input
   - Smart contracts should also validate

5. **HTTPS only**
   - Always serve over HTTPS in production
   - Use secure RPC endpoints

## Monitoring

Consider setting up:
- Error tracking (Sentry, Rollbar)
- Analytics (Google Analytics, Plausible)
- Uptime monitoring (UptimeRobot)
- Performance monitoring (Vercel Analytics)

## Updates

To update the deployment:

```bash
# Pull latest changes
git pull origin main

# Rebuild
npm run build

# Redeploy
vercel --prod  # or your deployment method
```

## Support

If you encounter issues:
1. Check the console for errors
2. Verify network and contract configuration
3. Test on testnet first
4. Review the documentation
5. Open an issue on GitHub
