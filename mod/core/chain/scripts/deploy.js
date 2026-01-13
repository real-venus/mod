const hre = require('hardhat');

async function main() {
  console.log('🚀 Deploying BlocTime Protocol with TokenGate and Oracle...');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  // Deploy Mock Native Token
  console.log('\n📦 Deploying Mock Native Token...');
  const BaseERC20 = await hre.ethers.getContractFactory('Token');
  const nativeToken = await BaseERC20.deploy(
    'Native Token',
    'NAT',
    hre.ethers.parseEther('1000000')
  );
  await nativeToken.waitForDeployment();
  console.log('Native Token deployed to:', await nativeToken.getAddress());

  // Deploy Payment Token for testing
  console.log('\n📦 Deploying Payment Token...');
  const paymentToken = await BaseERC20.deploy(
    'Payment Token',
    'PAY',
    hre.ethers.parseEther('1000000')
  );
  await paymentToken.waitForDeployment();
  console.log('Payment Token deployed to:', await paymentToken.getAddress());

  // Deploy Manual Price Oracle
  console.log('\n📦 Deploying Manual Price Oracle...');
  const ManualPriceOracle = await hre.ethers.getContractFactory('ManualPriceOracle');
  const oracle = await ManualPriceOracle.deploy();
  await oracle.waitForDeployment();
  console.log('Manual Price Oracle deployed to:', await oracle.getAddress());

  // Set price for payment token
  console.log('\n⚙️  Setting oracle price for payment token...');
  const tokenPrice = 100000000n; // $1 with 8 decimals
  await oracle.setPrice(await paymentToken.getAddress(), tokenPrice, 8);
  console.log('Payment token price set to $1.00');

  // Deploy TokenGate
  console.log('\n📦 Deploying TokenGate...');
  const TokenGate = await hre.ethers.getContractFactory('TokenGate');
  const tokenGate = await TokenGate.deploy(await oracle.getAddress());
  await tokenGate.waitForDeployment();
  console.log('TokenGate deployed to:', await tokenGate.getAddress());

  // Whitelist payment token in TokenGate
  console.log('\n⚙️  Whitelisting payment token...');
  await tokenGate.whitelistToken(await paymentToken.getAddress());
  console.log('Payment token whitelisted');

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

  // Whitelist payment token in Market
  console.log('\n⚙️  Whitelisting payment token in market...');
  await market.whitelistToken(await paymentToken.getAddress());
  console.log('Payment token whitelisted in market');

  // Summary
  console.log('\n📋 Deployment Summary:');
  console.log('========================');
  console.log('Native Token:', await nativeToken.getAddress());
  console.log('Payment Token:', await paymentToken.getAddress());
  console.log('Manual Price Oracle:', await oracle.getAddress());
  console.log('TokenGate:', await tokenGate.getAddress());
  console.log('BlocTime:', await blocTime.getAddress());
  console.log('Registry:', await registry.getAddress());
  console.log('Market:', await market.getAddress());
  console.log('========================');
  console.log('\n✅ Deployment complete!');
  console.log('\n💡 Export these addresses:');
  console.log('export NATIVE_TOKEN_ADDRESS=' + await nativeToken.getAddress());
  console.log('export PAYMENT_TOKEN_ADDRESS=' + await paymentToken.getAddress());
  console.log('export ORACLE_ADDRESS=' + await oracle.getAddress());
  console.log('export TOKENGATE_ADDRESS=' + await tokenGate.getAddress());
  console.log('export BLOCTIME_ADDRESS=' + await blocTime.getAddress());
  console.log('export REGISTRY_ADDRESS=' + await registry.getAddress());
  console.log('export MARKET_ADDRESS=' + await market.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
