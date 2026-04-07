const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying GoldFi with account:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Config — adjust these for your deployment
  const REWARD_TOKEN = process.env.REWARD_TOKEN || '0xe22970F0bB899C7D615ED522B2A807629F99ec01'; // USDC on Base Sepolia
  const ORACLE = process.env.ORACLE_ADDRESS || deployer.address; // deployer is oracle by default
  const EPOCH_DURATION = 7 * 24 * 60 * 60; // 7 days
  const PLATFORM_FEE_BPS = 100; // 1%

  // Deploy GoldFi
  const GoldFi = await ethers.getContractFactory('GoldFi');
  const goldfi = await GoldFi.deploy(
    REWARD_TOKEN,
    ORACLE,
    EPOCH_DURATION,
    PLATFORM_FEE_BPS
  );
  await goldfi.waitForDeployment();
  const address = await goldfi.getAddress();
  console.log('GoldFi deployed to:', address);

  // Add default assets: Gold (PAXG) and Silver
  const PAXG = '0x45804880De22913dAFE09f4980848ECE6EcbAf78';
  const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

  await goldfi.addAsset('PAXG', PAXG, USDC);
  console.log('Added asset: PAXG (Gold)');

  // Save deployment info
  const fs = require('fs');
  const config = {
    network: hre.network.name,
    goldfi: address,
    rewardToken: REWARD_TOKEN,
    oracle: ORACLE,
    epochDuration: EPOCH_DURATION,
    platformFeeBps: PLATFORM_FEE_BPS,
    assets: { PAXG: PAXG },
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };
  fs.writeFileSync('deployment.json', JSON.stringify(config, null, 2));
  console.log('Deployment config saved to deployment.json');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
