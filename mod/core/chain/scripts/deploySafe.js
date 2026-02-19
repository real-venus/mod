const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 Starting Safe contracts deployment...\n');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);
  console.log('Account balance:', hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), 'ETH\n');

  // Deploy Safe Singleton (implementation)
  console.log('📦 Deploying Safe singleton...');
  const Safe = await hre.ethers.getContractFactory('Safe');
  const safeSingleton = await Safe.deploy();
  await safeSingleton.waitForDeployment();
  const singletonAddress = await safeSingleton.getAddress();
  console.log('✅ Safe singleton deployed to:', singletonAddress);

  // Deploy SafeProxyFactory
  console.log('\n📦 Deploying SafeProxyFactory...');
  const SafeProxyFactory = await hre.ethers.getContractFactory('SafeProxyFactory');
  const proxyFactory = await SafeProxyFactory.deploy();
  await proxyFactory.waitForDeployment();
  const factoryAddress = await proxyFactory.getAddress();
  console.log('✅ SafeProxyFactory deployed to:', factoryAddress);

  // Save deployment addresses
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      SafeSingleton: singletonAddress,
      SafeProxyFactory: factoryAddress,
    },
  };

  const deploymentDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  const filename = `safe-${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  console.log('\n📄 Deployment info saved to:', filepath);

  // Example: Create a Safe proxy instance
  console.log('\n🔧 Creating example Safe proxy...');

  const owners = [deployer.address]; // Single owner for example
  const threshold = 1; // Require 1 signature

  // Encode setup call
  const setupData = Safe.interface.encodeFunctionData('setup', [
    owners,
    threshold,
    hre.ethers.ZeroAddress, // to
    '0x', // data
    hre.ethers.ZeroAddress, // fallbackHandler
    hre.ethers.ZeroAddress, // paymentToken
    0, // payment
    hre.ethers.ZeroAddress, // paymentReceiver
  ]);

  // Create proxy using factory
  const saltNonce = Date.now();
  const tx = await proxyFactory.createProxyWithNonce(singletonAddress, setupData, saltNonce);
  const receipt = await tx.wait();

  // Get proxy address from event
  const event = receipt.logs.find(
    (log) => log.topics[0] === proxyFactory.interface.getEvent('ProxyCreation').topicHash
  );
  const proxyAddress = '0x' + event.topics[1].slice(26);

  console.log('✅ Example Safe proxy created at:', proxyAddress);
  console.log('   Owners:', owners);
  console.log('   Threshold:', threshold);

  // Verify the proxy is set up correctly
  const safeProxy = await hre.ethers.getContractAt('Safe', proxyAddress);
  const actualOwners = await safeProxy.getOwners();
  const actualThreshold = await safeProxy.getThreshold();
  console.log('\n🔍 Verification:');
  console.log('   Retrieved owners:', actualOwners);
  console.log('   Retrieved threshold:', actualThreshold.toString());

  console.log('\n✨ Deployment complete!');
  console.log('\n📋 Summary:');
  console.log('   Network:', hre.network.name);
  console.log('   Safe Singleton:', singletonAddress);
  console.log('   Proxy Factory:', factoryAddress);
  console.log('   Example Proxy:', proxyAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
