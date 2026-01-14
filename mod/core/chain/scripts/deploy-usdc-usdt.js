const hre = require('hardhat');

async function main() {
  console.log('🚀 Deploying BlocTime Protocol with USDC/USDT Manual Oracles...');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log('Network:', hre.network.name);

  // Deploy USDC Mock Token
  console.log('\n📦 Deploying USDC Token...');
  const Token = await hre.ethers.getContractFactory('Token');
  const usdc = await Token.deploy(
    'USD Coin',
    'USDC',
    hre.ethers.parseUnits('1000000', 6) // 1M USDC with 6 decimals
  );
  await usdc.waitForDeployment();
  console.log('USDC deployed to:', await usdc.getAddress());

  // Deploy USDT Mock Token
  console.log('\n📦 Deploying USDT Token...');
  const usdt = await Token.deploy(
    'Tether USD',
    'USDT',
    hre.ethers.parseUnits('1000000', 6) // 1M USDT with 6 decimals
  );
  await usdt.waitForDeployment();
  console.log('USDT deployed to:', await usdt.getAddress());

  // Deploy Manual Price Oracle
  console.log('\n📦 Deploying Manual Price Oracle...');
  const ManualPriceOracle = await hre.ethers.getContractFactory('ManualPriceOracle');
  const oracle = await ManualPriceOracle.deploy();
  await oracle.waitForDeployment();
  console.log('Manual Price Oracle deployed to:', await oracle.getAddress());

  // Set prices for USDC and USDT
  console.log('\n⚙️  Setting oracle prices...');
  const usdPrice = 100000000n; // $1.00 with 8 decimals
  await oracle.setPrice(await usdc.getAddress(), usdPrice, 8);
  console.log('USDC price set to $1.00');
  
  await oracle.setPrice(await usdt.getAddress(), usdPrice, 8);
  console.log('USDT price set to $1.00');

  // Deploy TokenGate
  console.log('\n📦 Deploying TokenGate...');
  const TokenGate = await hre.ethers.getContractFactory('TokenGate');
  const tokenGate = await TokenGate.deploy(await oracle.getAddress());
  await tokenGate.waitForDeployment();
  console.log('TokenGate deployed to:', await tokenGate.getAddress());

  // Whitelist USDC and USDT in TokenGate
  console.log('\n⚙️  Whitelisting tokens in TokenGate...');
  await tokenGate.whitelistToken(await usdc.getAddress());
  console.log('USDC whitelisted');
  
  await tokenGate.whitelistToken(await usdt.getAddress());
  console.log('USDT whitelisted');

  // Deploy Native Token for staking
  console.log('\n📦 Deploying Native Token...');
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

  // Deploy Market
  console.log('\n📦 Deploying Market...');
  const Market = await hre.ethers.getContractFactory('Market');
  const market = await Market.deploy(
    'BlocTime Market Token',
    'BTMT',
    deployer.address,
    await oracle.getAddress()
  );
  await market.waitForDeployment();
  console.log('Market deployed to:', await market.getAddress());

  // Whitelist USDC and USDT in Market
  console.log('\n⚙️  Whitelisting tokens in Market...');
  await market.whitelistToken(await usdc.getAddress());
  console.log('USDC whitelisted in market');
  
  await market.whitelistToken(await usdt.getAddress());
  console.log('USDT whitelisted in market');

  // Summary
  console.log('\n📋 Deployment Summary:');
  console.log('========================');
  console.log('Network:', hre.network.name);
  console.log('USDC Token:', await usdc.getAddress());
  console.log('USDT Token:', await usdt.getAddress());
  console.log('Manual Price Oracle:', await oracle.getAddress());
  console.log('TokenGate:', await tokenGate.getAddress());
  console.log('Native Token:', await nativeToken.getAddress());
  console.log('BlocTime:', await blocTime.getAddress());
  console.log('Registry:', await registry.getAddress());
  console.log('Market:', await market.getAddress());
  console.log('========================');
  console.log('\n✅ Deployment complete!');
  console.log('\n💡 Export these addresses:');
  console.log('export USDC_ADDRESS=' + await usdc.getAddress());
  console.log('export USDT_ADDRESS=' + await usdt.getAddress());
  console.log('export ORACLE_ADDRESS=' + await oracle.getAddress());
  console.log('export TOKENGATE_ADDRESS=' + await tokenGate.getAddress());
  console.log('export NATIVE_TOKEN_ADDRESS=' + await nativeToken.getAddress());
  console.log('export BLOCTIME_ADDRESS=' + await blocTime.getAddress());
  console.log('export REGISTRY_ADDRESS=' + await registry.getAddress());
  console.log('export MARKET_ADDRESS=' + await market.getAddress());
  
  console.log('\n📝 Network-specific commands:');
  console.log('# Deploy to Ganache (local):');
  console.log('npx hardhat run scripts/deploy-usdc-usdt.js --network ganache');
  console.log('\n# Deploy to Base Testnet:');
  console.log('npx hardhat run scripts/deploy-usdc-usdt.js --network base_testnet');
  console.log('\n# Deploy to Base Mainnet:');
  console.log('npx hardhat run scripts/deploy-usdc-usdt.js --network base_mainnet');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
