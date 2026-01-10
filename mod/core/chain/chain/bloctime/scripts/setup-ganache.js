const hre = require('hardhat');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function main() {
  console.log('🔧 Setting up Ganache server for BlocTime...');

  // Check if Ganache is running
  try {
    await hre.ethers.provider.getNetwork();
    console.log('✅ Ganache is already running');
  } catch (error) {
    console.log('❌ Ganache is not running');
    console.log('Starting Ganache via Docker Compose...');
    
    try {
      const { stdout, stderr } = await execPromise('docker-compose up -d ganache');
      console.log(stdout);
      if (stderr) console.error(stderr);
      
      // Wait for Ganache to be ready
      console.log('⏳ Waiting for Ganache to be ready...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verify connection
      const network = await hre.ethers.provider.getNetwork();
      console.log('✅ Ganache started successfully on chainId:', network.chainId);
    } catch (dockerError) {
      console.error('Failed to start Ganache:', dockerError.message);
      process.exit(1);
    }
  }

  // Display network info
  const network = await hre.ethers.provider.getNetwork();
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log('\n📊 Ganache Network Info:');
  console.log('========================');
  console.log('Chain ID:', network.chainId.toString());
  console.log('Block Number:', blockNumber);
  console.log('Deployer Address:', deployer.address);
  console.log('Deployer Balance:', hre.ethers.formatEther(balance), 'ETH');
  console.log('========================');
  console.log('\n✅ Ganache setup complete!');
  console.log('\n💡 Next steps:');
  console.log('   npm run deploy:ganache  # Deploy contracts');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
