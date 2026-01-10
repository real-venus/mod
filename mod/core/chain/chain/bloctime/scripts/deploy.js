const hre = require('hardhat');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function main() {
  console.log('🚀 Deploying BlocTime Protocol...');

  // Check if Ganache is running, start if not
  try {
    await hre.ethers.provider.getNetwork();
    console.log('✅ Ganache is running');
  } catch (error) {
    console.log('❌ Ganache not running, starting it...');
    try {
      const { stdout } = await execPromise('docker-compose up -d ganache');
      console.log(stdout);
      console.log('⏳ Waiting for Ganache to be ready...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      await hre.ethers.provider.getNetwork();
      console.log('✅ Ganache started successfully');
    } catch (dockerError) {
      console.error('Failed to start Ganache:', dockerError.message);
      console.log('Please run: docker-compose up -d ganache');
      process.exit(1);
    }
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  // Deploy Mock Native Token (for testing)
  console.log('\n📦 Deploying Mock Native Token...');
  const BaseERC20 = await hre.ethers.getContractFactory('Token');
  console.log('base arguments erc20 deploy');
  console.log('deployer address:', deployer.address);
  // balance before deployment
  const balanceBefore = await hre.ethers.provider.getBalance(deployer.address);
  console.log('deployer balance before:', hre.ethers.formatEther(balanceBefore));
  const nativeToken = await BaseERC20.deploy(
    'Native Token',
    'NAT',
    hre.ethers.parseEther('1000000')
  );
  await nativeToken.waitForDeployment();
  console.log('Native Token deployed to:', await nativeToken.getAddress());

  // Deploy BlocTime (unified staking + token)
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
    deployer.address
  );
  await market.waitForDeployment();
  console.log('Market deployed to:', await market.getAddress());

  // Summary
  console.log('\n📋 Deployment Summary:');
  console.log('========================');
  console.log('Native Token:', await nativeToken.getAddress());
  console.log('BlocTime:', await blocTime.getAddress());
  console.log('Registry:', await registry.getAddress());
  console.log('Market:', await market.getAddress());
  console.log('========================');
  console.log('\n✅ Deployment complete!');
  console.log('\n💡 Export these addresses:');
  console.log('export NATIVE_TOKEN_ADDRESS=' + await nativeToken.getAddress());
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
