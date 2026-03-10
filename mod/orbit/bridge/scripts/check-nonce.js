const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Account:", deployer.address);

  // Get current nonce from network
  const nonce = await hre.ethers.provider.getTransactionCount(deployer.address, "latest");
  console.log("Latest nonce:", nonce);

  // Get pending nonce
  const pendingNonce = await hre.ethers.provider.getTransactionCount(deployer.address, "pending");
  console.log("Pending nonce:", pendingNonce);

  if (pendingNonce > nonce) {
    console.log("\n⚠ Warning: There are", pendingNonce - nonce, "pending transactions!");
    console.log("Wait for them to confirm or cancel them before deploying again.");
  } else {
    console.log("\n✓ No pending transactions. Safe to deploy.");
  }

  // Get balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("\nAccount balance:", hre.ethers.formatEther(balance), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
