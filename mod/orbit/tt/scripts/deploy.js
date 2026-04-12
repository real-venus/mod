const hre = require("hardhat");

async function main() {
  const emissionRate = hre.ethers.parseEther("100"); // 100 tokens per epoch
  const decayBps = 500;   // 5% decay per epoch
  const epochLength = 50; // 50 blocks per epoch

  const TT = await hre.ethers.getContractFactory("TT");
  const tt = await TT.deploy(emissionRate, decayBps, epochLength);
  await tt.waitForDeployment();

  const address = await tt.getAddress();
  console.log(`TT deployed to: ${address}`);

  // Write deployment info
  const fs = require("fs");
  const path = require("path");
  const info = {
    address,
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    emissionRate: emissionRate.toString(),
    decayBps,
    epochLength,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(__dirname, "..", "deployment.json"),
    JSON.stringify(info, null, 2)
  );
  console.log("Deployment info saved to deployment.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
