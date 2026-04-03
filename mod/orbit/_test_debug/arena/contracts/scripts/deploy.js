const hre = require("hardhat");

async function main() {
  console.log("Deploying Arena contracts to Base Sepolia...");

  // Deploy Leaderboard
  const ArenaLeaderboard = await hre.ethers.getContractFactory("ArenaLeaderboard");
  const leaderboard = await ArenaLeaderboard.deploy();
  await leaderboard.waitForDeployment();
  const leaderboardAddress = await leaderboard.getAddress();

  console.log("ArenaLeaderboard deployed to:", leaderboardAddress);

  // Deploy RewardPool
  const RewardPool = await hre.ethers.getContractFactory("RewardPool");
  const rewardPool = await RewardPool.deploy(leaderboardAddress);
  await rewardPool.waitForDeployment();
  const rewardPoolAddress = await rewardPool.getAddress();

  console.log("RewardPool deployed to:", rewardPoolAddress);

  // Save deployment info
  const deploymentInfo = {
    network: "baseSepolia",
    chainId: 84532,
    contracts: {
      ArenaLeaderboard: leaderboardAddress,
      RewardPool: rewardPoolAddress,
    },
    timestamp: new Date().toISOString(),
  };

  const fs = require("fs");
  fs.writeFileSync(
    "./deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\nDeployment info saved to deployment.json");
  console.log("\nNext steps:");
  console.log("1. Copy deployment.json to app/config.json");
  console.log("2. Update your frontend with the contract addresses");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
