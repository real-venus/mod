const hre = require("hardhat");

// Mock ERC20 token contract for testing
const MOCK_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

// Real mainnet addresses
const MAINNET_ADDRESSES = {
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Ethereum mainnet USDT
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"  // Ethereum mainnet USDC
};

async function main() {
  const network = hre.network.name;
  console.log(`Deploying to network: ${network}`);

  let usdtAddress, usdcAddress;

  if (network === "mainnet") {
    // Use real USDT and USDC addresses on mainnet
    usdtAddress = MAINNET_ADDRESSES.USDT;
    usdcAddress = MAINNET_ADDRESSES.USDC;
    console.log("Using real mainnet addresses:");
    console.log(`USDT: ${usdtAddress}`);
    console.log(`USDC: ${usdcAddress}`);
  } else {
    // Deploy mock tokens for local/test networks
    console.log("Deploying mock USDT and USDC tokens...");
    
    const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
    
    const mockUSDT = await MockERC20.deploy("Tether USD", "USDT", 6);
    await mockUSDT.deployed();
    usdtAddress = mockUSDT.address;
    console.log(`Mock USDT deployed to: ${usdtAddress}`);

    const mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
    await mockUSDC.deployed();
    usdcAddress = mockUSDC.address;
    console.log(`Mock USDC deployed to: ${usdcAddress}`);
  }

  // Deploy manual oracle for 1:1 peg
  console.log("\nDeploying Manual Oracle with 1:1 peg...");
  const ManualOracle = await hre.ethers.getContractFactory("ManualOracle");
  const oracle = await ManualOracle.deploy();
  await oracle.deployed();
  console.log(`Manual Oracle deployed to: ${oracle.address}`);

  // Set 1:1 price for both tokens (using 8 decimals for price feed)
  const oneToOnePrice = hre.ethers.utils.parseUnits("1", 8);
  await oracle.setPrice(usdtAddress, oneToOnePrice);
  await oracle.setPrice(usdcAddress, oneToOnePrice);
  console.log(`Set 1:1 peg for USDT and USDC`);

  // Save deployment info
  const deploymentInfo = {
    network,
    timestamp: new Date().toISOString(),
    addresses: {
      USDT: usdtAddress,
      USDC: usdcAddress,
      Oracle: oracle.address
    },
    isMainnet: network === "mainnet"
  };

  console.log("\n=== Deployment Summary ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Write to file
  const fs = require("fs");
  const path = require("path");
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(deploymentsDir, `${network}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
