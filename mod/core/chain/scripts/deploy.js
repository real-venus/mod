const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Real mainnet USDT and USDC addresses
const MAINNET_ADDRESSES = {
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
};

// Helper to send tx and wait for 1 confirmation
async function sendAndConfirm(txPromise, label = "Transaction") {
  const tx = await txPromise;
  console.log(`${label} tx sent: ${tx.hash}`);
  const receipt = await tx.wait(1);
  console.log(`${label} confirmed in block ${receipt.blockNumber}`);
  
  // 2-second delay after confirmation (this is the increased value)
  console.log(`Waiting 2 seconds for node stability...`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return receipt;
}

async function main() {
  console.log("🚀 Deploying BlocTime Protocol...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Network:", hre.network.name);

  let usdcAddress, usdtAddress, usdc, usdt;

  if (hre.network.name === "mainnet" || hre.network.name === "base_mainnet") {
    usdtAddress = MAINNET_ADDRESSES.USDT;
    usdcAddress = MAINNET_ADDRESSES.USDC;
    console.log("\n🌐 Using REAL mainnet addresses:");
    console.log("USDT:", usdtAddress);
    console.log("USDC:", usdcAddress);
  } else {
    console.log("\n📦 Deploying MOCK tokens for testing...");

    const Token = await hre.ethers.getContractFactory("Token");

    // Mock USDT
    let nonce = await deployer.getNonce('pending');
    const usdtDeployTx = await Token.deploy("Tether USD", "USDT", hre.ethers.parseEther("1000000"), { nonce });
    await sendAndConfirm(usdtDeployTx.deploymentTransaction(), "Mock USDT deploy");
    usdt = usdtDeployTx;
    usdtAddress = await usdt.getAddress();
    console.log("Mock USDT deployed to:", usdtAddress);

    // Mock USDC
    nonce = await deployer.getNonce('pending');
    const usdcDeployTx = await Token.deploy("USD Coin", "USDC", hre.ethers.parseEther("1000000"), { nonce });
    await sendAndConfirm(usdcDeployTx.deploymentTransaction(), "Mock USDC deploy");
    usdc = usdcDeployTx;
    usdcAddress = await usdc.getAddress();
    console.log("Mock USDC deployed to:", usdcAddress);
  }

  // Manual Price Oracle
  console.log("\n📦 Deploying Manual Price Oracle...");
  const ManualPriceOracle = await hre.ethers.getContractFactory("ManualPriceOracle");
  const oracleDeployTx = await ManualPriceOracle.deploy();
  await sendAndConfirm(oracleDeployTx.deploymentTransaction(), "ManualPriceOracle deploy");
  const oracle = oracleDeployTx;
  const oracleAddress = await oracle.getAddress();
  console.log("Manual Price Oracle deployed to:", oracleAddress);

  console.log("\n⚙️ Setting 1:1 oracle prices...");
  const usdPrice = 100000000n; // $1.00 with 8 decimals

  // Get fresh nonce for USDC price
  let nonce = await deployer.getNonce('pending');
  await sendAndConfirm(oracle.setPrice(usdcAddress, usdPrice, 8, { nonce }), "USDC price set");

  // Get fresh nonce for USDT price
  nonce = await deployer.getNonce('pending');
  await sendAndConfirm(oracle.setPrice(usdtAddress, usdPrice, 8, { nonce }), "USDT price set");

  console.log("USDC & USDT prices set to $1.00");

  // TokenGate
  console.log("\n📦 Deploying TokenGate...");
  const TokenGate = await hre.ethers.getContractFactory("TokenGate");
  const tokenGateDeployTx = await TokenGate.deploy(oracleAddress);
  await sendAndConfirm(tokenGateDeployTx.deploymentTransaction(), "TokenGate deploy");
  const tokenGate = tokenGateDeployTx;
  const tokenGateAddress = await tokenGate.getAddress();
  console.log("TokenGate deployed to:", tokenGateAddress);

  console.log("\n⚙️ Whitelisting tokens in TokenGate...");
  nonce = await deployer.getNonce('pending');
  await sendAndConfirm(tokenGate.whitelistToken(usdcAddress, { nonce }), "USDC whitelist");

  nonce = await deployer.getNonce('pending');
  await sendAndConfirm(tokenGate.whitelistToken(usdtAddress, { nonce }), "USDT whitelist");

  console.log("USDC & USDT whitelisted");

  // Native Token
  console.log("\n📦 Deploying Native Token...");
  const Token = await hre.ethers.getContractFactory("Token");
  const nativeTokenDeployTx = await Token.deploy("Native Token", "NAT", hre.ethers.parseEther("1000000"));
  await sendAndConfirm(nativeTokenDeployTx.deploymentTransaction(), "Native Token deploy");
  const nativeToken = nativeTokenDeployTx;
  const nativeTokenAddress = await nativeToken.getAddress();
  console.log("Native Token deployed to:", nativeTokenAddress);

  // BlocTime
  console.log("\n📦 Deploying BlocTime...");
  const BlocTime = await hre.ethers.getContractFactory("BlocTime");
  const blocTimeDeployTx = await BlocTime.deploy(
    nativeTokenAddress,
    "BlocTime Token",
    "BLOC",
    100000,
    5000
  );
  await sendAndConfirm(blocTimeDeployTx.deploymentTransaction(), "BlocTime deploy");
  const blocTime = blocTimeDeployTx;
  const blocTimeAddress = await blocTime.getAddress();
  console.log("BlocTime deployed to:", blocTimeAddress);

  console.log("\n⚙️ Setting multiplier points...");
  const points = [
    { blocks: 0, multiplier: 10000 },
    { blocks: 10000, multiplier: 15000 },
    { blocks: 50000, multiplier: 20000 },
    { blocks: 100000, multiplier: 30000 },
  ];
  nonce = await deployer.getNonce('pending');
  await sendAndConfirm(blocTime.setPoints(points, { nonce }), "Multiplier points set");
  console.log("Multiplier points set successfully");

  // Registry
  console.log("\n📦 Deploying Registry...");
  const Registry = await hre.ethers.getContractFactory("Registry");
  const registryDeployTx = await Registry.deploy();
  await sendAndConfirm(registryDeployTx.deploymentTransaction(), "Registry deploy");
  const registry = registryDeployTx;
  const registryAddress = await registry.getAddress();
  console.log("Registry deployed to:", registryAddress);

  // Treasury
  console.log("\n📦 Deploying Treasury...");
  const Treasury = await hre.ethers.getContractFactory("Treasury");
  const treasuryDeployTx = await Treasury.deploy(2000, tokenGateAddress);
  await sendAndConfirm(treasuryDeployTx.deploymentTransaction(), "Treasury deploy");
  const treasury = treasuryDeployTx;
  const treasuryAddress = await treasury.getAddress();
  console.log("Treasury deployed to:", treasuryAddress);

  nonce = await deployer.getNonce('pending');
  await sendAndConfirm(treasury.setGovernanceToken(blocTimeAddress, { nonce }), "Governance token set");
  console.log("Governance token set to BlocTime");

  // Market
  console.log("\n📦 Deploying Market...");
  const Market = await hre.ethers.getContractFactory("Market");
  const marketDeployTx = await Market.deploy(
    "BlocTime Market Token",
    "BTMT",
    treasuryAddress,
    tokenGateAddress
  );
  await sendAndConfirm(marketDeployTx.deploymentTransaction(), "Market deploy");
  const market = marketDeployTx;
  const marketAddress = await market.getAddress();
  console.log("Market deployed to:", marketAddress);

  // Debit
  console.log("\n📦 Deploying Debit...");
  const Debit = await hre.ethers.getContractFactory("Debit");
  const debitDeployTx = await Debit.deploy(marketAddress);
  await sendAndConfirm(debitDeployTx.deploymentTransaction(), "Debit deploy");
  const debit = debitDeployTx;
  const debitAddress = await debit.getAddress();
  console.log("Debit deployed to:", debitAddress);

  console.log("\n⚙️ Authorizing Debit contract on Market...");
  nonce = await deployer.getNonce('pending');
  await sendAndConfirm(market.setDebitContract(debitAddress, { nonce }), "Debit contract authorized");
  console.log("Debit contract authorized on Market");

  // Save to config.json (unchanged)
  const chainId = (await hre.ethers.provider.getNetwork()).chainId.toString();
  const networkName = hre.network.name;
  const configPath = path.join(__dirname, "..", "config.json");

  let existingConfig = { deployments: {} };
  if (fs.existsSync(configPath)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      existingConfig.deployments = existingConfig.deployments || {};
    } catch (e) {
      console.warn("⚠️ Could not parse config.json – creating new");
    }
  }

  existingConfig.deployments[networkName] = {
    chainId,
    deployer: deployer.address,
    url: hre.network.config.url || "",
    contracts: {
      USDC: { address: usdcAddress, contract: "Token" },
      USDT: { address: usdtAddress, contract: "Token" },
      ManualPriceOracle: { address: oracleAddress, contract: "ManualPriceOracle" },
      TokenGate: { address: tokenGateAddress, contract: "TokenGate" },
      NativeToken: { address: nativeTokenAddress, contract: "Token" },
      BlocTime: { address: blocTimeAddress, contract: "BlocTime" },
      Registry: { address: registryAddress, contract: "Registry" },
      Treasury: { address: treasuryAddress, contract: "Treasury" },
      Market: { address: marketAddress, contract: "Market" },
      Debit: { address: debitAddress, contract: "Debit" },
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));
  console.log("\n📝 Deployment addresses saved to config.json");

  console.log("\n📋 Deployment Summary:");
  console.log("Network:", networkName);
  console.log("Deployer:", deployer.address);
  console.log("USDC:", usdcAddress);
  console.log("USDT:", usdtAddress);
  console.log("Oracle:", oracleAddress);
  console.log("TokenGate:", tokenGateAddress);
  console.log("Native Token:", nativeTokenAddress);
  console.log("BlocTime:", blocTimeAddress);
  console.log("Registry:", registryAddress);
  console.log("Treasury:", treasuryAddress);
  console.log("Market:", marketAddress);
  console.log("Debit:", debitAddress);
  console.log("\n✅ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });