const ganache = require('ganache');

// List of public keys to fund
const publicKeysToFund = [
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  '0x5aeda56215b167893e80b4fe645ba6d5bab767de',
  // Add more public keys here
];

// Ganache options
const options = {
  wallet: {
    accounts: publicKeysToFund.map(address => ({
      secretKey: '0x' + '0'.repeat(64), // Placeholder, ganache will generate
      balance: '0x56BC75E2D63100000' // 100 ETH in wei
    })),
    defaultBalance: 100 // 100 ETH for each account
  },
  chain: {
    chainId: 1337
  },
  server: {
    host: '0.0.0.0',
    port: 8545
  },
  logging: {
    verbose: true
  }
};

// Start Ganache
const server = ganache.server(options);
const PORT = 8545;

server.listen(PORT, async (err) => {
  if (err) throw err;
  
  console.log(`Ganache started on port ${PORT}`);
  console.log('Funded accounts:');
  
  const provider = server.provider;
  const accounts = await provider.request({
    method: 'eth_accounts',
    params: []
  });
  
  accounts.forEach((account, index) => {
    console.log(`Account ${index}: ${account}`);
  });
});
