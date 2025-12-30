const hre = require('hardhat');

async function main() {
  console.log('🚀 Deploying BlocTime Protocol...');
  
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  // Deploy Mock Token (for testing)
  console.log('\n📦 Deploying Mock Native Token...');
  const BaseERC20 = await hre.ethers.getContractFactory('BaseERC20');
  const nativeToken = await BaseERC20.deploy(
    'Native Token',
    'NAT',
    hre.ethers.parseEther('1000000')
  );
  await nativeToken.waitForDeployment();
  console.log('Native Token deployed to:', await nativeToken.getAddress());

  // Deploy Staking
  console.log('\n📦 Deploying BlocTimeStaking...');
  const BlocTimeStaking = await hre.ethers.getContractFactory('BlocTimeStaking');
  const staking = await BlocTimeStaking.deploy(
    await nativeToken.getAddress(),
    'BlocTime Token',
    'BLOC',
    100000, // maxLockBlocks
    5000    // 50% distribution
  );
  await staking.waitForDeployment();
  console.log('BlocTimeStaking deployed to:', await staking.getAddress());

  const blocTimeToken = await staking.blocTimeToken();
  console.log('BlocTimeToken deployed to:', blocTimeToken);

  // Set multiplier points
  console.log('\n⚙️  Setting multiplier points...');
  const points = [
    { blocks: 0, multiplier: 10000 },
    { blocks: 10000, multiplier: 15000 },
    { blocks: 50000, multiplier: 20000 },
    { blocks: 100000, multiplier: 30000 }
  ];
  await staking.setPoints(points);
  console.log('Multiplier points set successfully');

  // Deploy Registry
  console.log('\n📦 Deploying Registry...');
  const Registry = await hre.ethers.getContractFactory('Registry');
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  console.log('Registry deployed to:', await registry.getAddress());

  // Deploy Marketplace
  console.log('\n📦 Deploying BlocTimeMarketplaceV3...');
  const BlocTimeMarketplaceV3 = await hre.ethers.getContractFactory('BlocTimeMarketplaceV3');
  const marketplace = await BlocTimeMarketplaceV3.deploy(
    await nativeToken.getAddress(),
    await staking.getAddress(),
    await registry.getAddress(),
    250 // 2.5% treasury fee
  );
  await marketplace.waitForDeployment();
  console.log('BlocTimeMarketplaceV3 deployed to:', await marketplace.getAddress());

  // Deploy Integration
  console.log('\n📦 Deploying BlocTimeIntegration...');
  const BlocTimeIntegration = await hre.ethers.getContractFactory('BlocTimeIntegration');
  const integration = await BlocTimeIntegration.deploy(
    await marketplace.getAddress(),
    await registry.getAddress(),
    await staking.getAddress()
  );
  await integration.waitForDeployment();
  console.log('BlocTimeIntegration deployed to:', await integration.getAddress());

  // Health check
  console.log('\n🏥 Running health check...');
  const [marketplaceHealthy, registryHealthy, stakingHealthy, status] = await integration.healthCheck();
  console.log('Marketplace:', marketplaceHealthy ? '✅' : '❌');
  console.log('Registry:', registryHealthy ? '✅' : '❌');
  console.log('Staking:', stakingHealthy ? '✅' : '❌');
  console.log('Status:', status);

  // Summary
  console.log('\n📋 Deployment Summary:');
  console.log('========================');
  console.log('Native Token:', await nativeToken.getAddress());
  console.log('BlocTimeStaking:', await staking.getAddress());
  console.log('BlocTimeToken:', blocTimeToken);
  console.log('Registry:', await registry.getAddress());
  console.log('BlocTimeMarketplaceV3:', await marketplace.getAddress());
  console.log('BlocTimeIntegration:', await integration.getAddress());
  console.log('========================');
  console.log('\n✅ Deployment complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
