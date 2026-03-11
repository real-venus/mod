const hre = require("hardhat");
const fs = require("fs");

/**
 * Deploy Sr25519 Bridge contracts
 *
 * 1. Deploy BridgeToken with initial supply
 * 2. Deploy Bridge contract
 * 3. Approve bridge to spend operator's tokens
 * 4. Save deployment addresses
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Parameters
  const TOKEN_NAME = process.env.TOKEN_NAME || "Bridged Commune";
  const TOKEN_SYMBOL = process.env.TOKEN_SYMBOL || "BCOM";
  const INITIAL_SUPPLY = process.env.INITIAL_SUPPLY || "1000000000000000000"; // 1B tokens with 9 decimals

  console.log("\n=== Deploying BridgeToken ===");
  console.log("Name:", TOKEN_NAME);
  console.log("Symbol:", TOKEN_SYMBOL);
  console.log("Initial Supply:", INITIAL_SUPPLY);

  // Deploy BridgeToken
  const BridgeToken = await hre.ethers.getContractFactory("BridgeToken");
  const token = await BridgeToken.deploy(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY, {
    gasLimit: 5000000 // Increase gas limit for deployment
  });
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  console.log("✓ BridgeToken deployed to:", tokenAddress);

  // Wait a bit before next deployment to avoid nonce issues
  console.log("\nWaiting for network confirmation...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Deploy Bridge
  console.log("\n=== Deploying Bridge ===");

  // Force nonce refresh to avoid nonce mismatch
  const currentNonce = await hre.ethers.provider.getTransactionCount(deployer.address, "latest");
  console.log("Current nonce:", currentNonce);

  const Bridge = await hre.ethers.getContractFactory("Bridge");
  const bridge = await Bridge.deploy(tokenAddress, {
    gasLimit: 5000000, // Increase gas limit for deployment
    nonce: currentNonce
  });
  await bridge.waitForDeployment();
  const bridgeAddress = await bridge.getAddress();

  console.log("✓ Bridge deployed to:", bridgeAddress);

  // Wait before approval transaction
  console.log("\nWaiting for network confirmation...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Approve bridge to spend operator's tokens
  console.log("\n=== Approving bridge to spend tokens ===");

  // Force nonce refresh for approval
  const approveNonce = await hre.ethers.provider.getTransactionCount(deployer.address, "latest");
  console.log("Approve nonce:", approveNonce);

  const approveTx = await token.approve(bridgeAddress, INITIAL_SUPPLY, {
    gasLimit: 100000,
    nonce: approveNonce
  });
  await approveTx.wait();

  console.log("✓ Bridge approved to spend", INITIAL_SUPPLY, "tokens");

  // Verify balances
  const operatorBalance = await token.balanceOf(deployer.address);
  const allowance = await token.allowance(deployer.address, bridgeAddress);

  console.log("\n=== Deployment Summary ===");
  console.log("Operator:", deployer.address);
  console.log("Token:", tokenAddress);
  console.log("Bridge:", bridgeAddress);
  console.log("Operator Balance:", operatorBalance.toString());
  console.log("Bridge Allowance:", allowance.toString());


  // Save deployment info

  // 
  const deploymentPath = "deployment.json";

  let deployment = {};
  if (fs.existsSync(deploymentPath)) {
    try {
      const existingData = fs.readFileSync(deploymentPath);
      deployment = JSON.parse(existingData);
    } catch (error) {
      console.warn("⚠️ Failed to read existing deployment.json, starting fresh.");
    }
  }



  current_deployment = {
    chainId: hre.network.config.chainId,
    operator: deployer.address,
    contracts: {
      token: {
        address: tokenAddress,
        name: TOKEN_NAME,
        symbol: TOKEN_SYMBOL,
        initialSupply: INITIAL_SUPPLY
      },
      bridge: {
        address: bridgeAddress
      },
    },
    deployedAt: new Date().toISOString()
  };

  deployment[hre.network.name] = current_deployment;

  fs.writeFileSync(
    "deployment.json",
    JSON.stringify(deployment, null, 2)
  );


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
