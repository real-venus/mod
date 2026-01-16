const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

// Real mainnet USDT and USDC addresses
const MAINNET_ADDRESSES = {
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
};

async function main() {
  console.log('🚀 Deploying BlocTime Protocol...');

  // config ../config.json
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log('Network:', hre.network.name);

  let usdcAddress, usdtAddress, usdc, usdt;

  // Determine if we're on mainnet or test/local
  if (hre.network.name === 'mainnet' || hre.network.name === 'base_mainnet') {
    // Use real USDT and USDC addresses on mainnet
    usdtAddress = MAINNET_ADDRESSES.USDT;
    usdcAddress = MAINNET_ADDRESSES.USDC;
    console.log('\n🌐 Using REAL mainnet addresses:');
    console.log('USDT:', usdtAddress);
    console.log('USDC:', usdcAddress);
  } else {
    // Deploy mock tokens for local/test networks
    console.log('\n📦 Deploying MOCK tokens for testing...');
    const Token = await hre.ethers.getContractFactory('Token');
    
    usdt = await Token.deploy(
      'Tether USD',
      'USDT',
       hre.ethers.parseEther('1000000')
    );
    await usdt.waitForDeployment();
    usdtAddress = await usdt.getAddress();
    console.log('Mock USDT deployed to:', usdtAddress);

    usdc = await Token.deploy(
      'USD Coin',
      'USDC',
       hre.ethers.parseEther('1000000')
    );
    await usdc.waitForDeployment();
    usdcAddress = await usdc.getAddress();
    console.log('Mock USDC deployed to:', usdcAddress);
  }

  // Deploy Manual Price Oracle
  console.log('\n📦 Deploying Manual Price Oracle...');
  const ManualPriceOracle = await hre.ethers.getContractFactory('ManualPriceOracle');
  const oracle = await ManualPriceOracle.deploy();
  await oracle.waitForDeployment();
  console.log('Manual Price Oracle deployed to:', await oracle.getAddress());

  // Set 1:1 peg for USDC and USDT
  console.log('\n⚙️  Setting 1:1 oracle prices...');
  const usdPrice = 100000000n; // $1.00 with 8 decimals
  await oracle.setPrice(usdcAddress, usdPrice, 8);
  console.log('USDC price set to $1.00');
  
  await oracle.setPrice(usdtAddress, usdPrice, 8);
  console.log('USDT price set to $1.00');

  // Deploy TokenGate
  console.log('\n📦 Deploying TokenGate...');
  const TokenGate = await hre.ethers.getContractFactory('TokenGate');
  const tokenGate = await TokenGate.deploy(await oracle.getAddress());
  await tokenGate.waitForDeployment();
  console.log('TokenGate deployed to:', await tokenGate.getAddress());

  // Whitelist USDC and USDT in TokenGate
  console.log('\n⚙️  Whitelisting tokens in TokenGate...');
  await tokenGate.whitelistToken(usdcAddress);
  console.log('USDC whitelisted');
  
  await tokenGate.whitelistToken(usdtAddress);
  console.log('USDT whitelisted');

  // Deploy Native Token for staking
  console.log('\n📦 Deploying Native Token...');
  const Token = await hre.ethers.getContractFactory('Token');
  const nativeToken = await Token.deploy(
    'Native Token',
    'NAT',
    hre.ethers.parseEther('1000000')
  );
  await nativeToken.waitForDeployment();
  console.log('Native Token deployed to:', await nativeToken.getAddress());

  // Deploy BlocTime
  console.log('\n📦 Deploying BlocTime...');
  const BlocTime = await hre.ethers.getContractFactory('BlocTime');
  const blocTime = await BlocTime.deploy(
    await nativeToken.getAddress(),
    'BlocTime Token',
    'BLOC',
    100000,
    5000
  );
  await blocTime.waitForDeployment();
  console.log('BlocTime deployed to:', await blocTime.getAddress());

  // Set multiplier points
  console.log('\n⚙️  Setting multiplier points...');
  const points = [
    { blocks: 0, multiplier: 10000 },
    { blocks: 10000, multiplier: 15000 },
    { blocks: 50000, multiplier: 20000 },
    { blocks: 100000, multiplier: 30000 }
  ];
  await blocTime.setPoints(points);
  console.log('Multiplier points set successfully');

  // Deploy Registry
  console.log('\n📦 Deploying Registry...');
  const Registry = await hre.ethers.getContractFactory('Registry');
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  console.log('Registry deployed to:', await registry.getAddress());

  // Deploy Treasury with TokenGate
  console.log('\n📦 Deploying Treasury...');
  const Treasury = await hre.ethers.getContractFactory('Treasury');
  const treasury = await Treasury.deploy(2000, await tokenGate.getAddress());
  await treasury.waitForDeployment();
  console.log('Treasury deployed to:', await treasury.getAddress());

  // Set governance token in Treasury
  console.log('\n⚙️  Setting governance token in Treasury...');
  await treasury.setGovernanceToken(await blocTime.getAddress());
  console.log('Governance token set to BlocTime');

  // Deploy Market
  console.log('\n📦 Deploying Market...');
  const Market = await hre.ethers.getContractFactory('Market');
  const market = await Market.deploy(
    'BlocTime Market Token',
    'BTMT',
    await treasury.getAddress(),
    await tokenGate.getAddress()
  );
  await market.waitForDeployment();
  console.log('Market deployed to:', await market.getAddress());

  // Create deployment config with deployer at top and contracts organized by network/contract
  const chainId = (await hre.ethers.provider.getNetwork()).chainId.toString();
  const networkName = hre.network.name;
  const configPath = path.join(__dirname, '..', 'config.json');
  
  // Load existing config if it exists
  let existingConfig = { deployments: {} };
  if (fs.existsSync(configPath)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!existingConfig.deployments) {
        existingConfig.deployments = {};
      }
    } catch (e) {
      console.log('⚠️  Could not parse existing config.json, creating new one');
      existingConfig = { deployments: {} };
    }
  }

  // Update config with new deployment - deployer first, then contracts
  existingConfig.deployments[networkName] = {
    chainId: chainId,
    deployer: deployer.address,
    url: hre.network.config.url || '',
    contracts: {
      USDC: { address: await usdc.getAddress(),  contract : 'Token' },
      USDT: { address: await usdt.getAddress() , contract : 'Token' },
      ManualPriceOracle: { address: await oracle.getAddress() , contract : 'ManualPriceOracle' },
      TokenGate: { address: await tokenGate.getAddress() , contract : 'TokenGate' },
      NativeToken: { address: await nativeToken.getAddress() , contract : 'Token' },
      BlocTime: { address: await blocTime.getAddress() , contract : 'BlocTime' },
      Registry: { address: await registry.getAddress() , contract : 'Registry' },
      Treasury: { address: await treasury.getAddress() , contract : 'Treasury' },
      Market: { address: await market.getAddress() , contract : 'Market' }
    }
  };


  // Write config.json
  fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));
  console.log('\n📝 Deployment addresses saved to config.json');
  console.log('Format: contracts/{chainId}/{contractName}->address');
  console.log('Deployer address saved to contracts/{chainId}/deployer');

  // Summary
  console.log('\n📋 Deployment Summary:');
  console.log('\ndeployer address:', deployer.address);
  console.log('========================');
  console.log('Network:', hre.network.name);
  console.log('Mode:', hre.network.name === 'mainnet' || hre.network.name === 'base_mainnet' ? 'MAINNET (Real Tokens)' : 'TEST/LOCAL (Mock Tokens)');
  console.log('USDC Token:', usdcAddress);
  console.log('USDT Token:', usdtAddress);
  console.log('Manual Price Oracle:', await oracle.getAddress());
  console.log('TokenGate:', await tokenGate.getAddress());
  console.log('Native Token:', await nativeToken.getAddress());
  console.log('BlocTime:', await blocTime.getAddress());
  console.log('Registry:', await registry.getAddress());
  console.log('Treasury:', await treasury.getAddress());
  console.log('Market:', await market.getAddress());
  console.log('========================');
  console.log('\n✅ Deployment complete!');
  console.log('\n💡 Export these addresses:');
  console.log('export USDC_ADDRESS=' + usdcAddress);
  console.log('export USDT_ADDRESS=' + usdtAddress);
  console.log('export ORACLE_ADDRESS=' + await oracle.getAddress());
  console.log('export TOKENGATE_ADDRESS=' + await tokenGate.getAddress());
  console.log('export NATIVE_TOKEN_ADDRESS=' + await nativeToken.getAddress());
  console.log('export BLOCTIME_ADDRESS=' + await blocTime.getAddress());
  console.log('export REGISTRY_ADDRESS=' + await registry.getAddress());
  console.log('export TREASURY_ADDRESS=' + await treasury.getAddress());
  console.log('export MARKET_ADDRESS=' + await market.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
