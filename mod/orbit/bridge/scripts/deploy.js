const hre = require("hardhat");
const fs = require("fs");

/**
 * Deploy Sr25519 Bridge contracts
 *
 * 1. Deploy BridgeToken with initial supply
 * 2. Deploy Sr25519Bridge contract
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
  const token = await BridgeToken.deploy(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  console.log("✓ BridgeToken deployed to:", tokenAddress);

  // Deploy Sr25519Bridge
  console.log("\n=== Deploying Sr25519Bridge ===");
  const Sr25519Bridge = await hre.ethers.getContractFactory("Sr25519Bridge");
  const bridge = await Sr25519Bridge.deploy(tokenAddress);
  await bridge.waitForDeployment();
  const bridgeAddress = await bridge.getAddress();

  console.log("✓ Sr25519Bridge deployed to:", bridgeAddress);

  // Approve bridge to spend operator's tokens
  console.log("\n=== Approving bridge to spend tokens ===");
  const approveTx = await token.approve(bridgeAddress, INITIAL_SUPPLY);
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
  const deployment = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    operator: deployer.address,
    token: {
      address: tokenAddress,
      name: TOKEN_NAME,
      symbol: TOKEN_SYMBOL,
      initialSupply: INITIAL_SUPPLY
    },
    bridge: {
      address: bridgeAddress
    },
    deployedAt: new Date().toISOString()
  };

  fs.writeFileSync(
    "deployment.json",
    JSON.stringify(deployment, null, 2)
  );

  console.log("\n✓ Deployment info saved to deployment.json");

  // Generate bridge config for Python backend
  const bridgeConfig = {
    rpc_url: hre.network.config.url,
    bridge_contract: bridgeAddress,
    token_contract: tokenAddress,
    operator_key: "YOUR_PRIVATE_KEY_HERE",
    snapshot_path: "bridge/total_balances.json",
    signature_timeout: 300
  };

  fs.writeFileSync(
    "bridge_config.json",
    JSON.stringify(bridgeConfig, null, 2)
  );

  console.log("✓ Bridge config template saved to bridge_config.json");
  console.log("\n⚠ Remember to update bridge_config.json with your private key!");

  // Verification command
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n=== Verification Commands ===");
    console.log(`npx hardhat verify --network ${hre.network.name} ${tokenAddress} "${TOKEN_NAME}" "${TOKEN_SYMBOL}" "${INITIAL_SUPPLY}"`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${bridgeAddress} ${tokenAddress}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
