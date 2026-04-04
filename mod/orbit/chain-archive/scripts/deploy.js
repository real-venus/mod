const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// ETH sentinel used by Market.sol for native ETH minting
const ETH_SENTINEL = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// Real mainnet token addresses per chain
const CHAIN_TOKENS = {
  ethereum: {
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    DAI:  "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  },
  base: {
    USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    DAI:  "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
  },
  arbitrum: {
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    DAI:  "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  },
  polygon: {
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    DAI:  "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  },
};

// Chainlink ETH/USD price feed addresses per chain
const CHAINLINK_ETH_USD = {
  ethereum: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  base:     "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
  arbitrum: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
  polygon:  "0xF9680D99D6C9589e2a93a78A04A279e509205945",
};

// Chainlink stablecoin/USD price feeds per chain (for real oracle pricing)
const CHAINLINK_STABLE_USD = {
  ethereum: {
    USDT: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
    USDC: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
    DAI:  "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
  },
  base: {
    USDC: "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B",
  },
  arbitrum: {
    USDT: "0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7",
    USDC: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3",
    DAI:  "0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB",
  },
  polygon: {
    USDT: "0x0A6513e40db6EB1b165753AD52E80663aeA50545",
    USDC: "0xfE4A8cc5b5B2366C1B58Bea3858e81843583ee2e",
    DAI:  "0x4746DeC9e833A82EC7C2C1245845D6ACbeFd428A",
  },
};

// Helper to send tx and wait for 1 confirmation
async function sendAndConfirm(txPromise, label = "Transaction") {
  const tx = await txPromise;
  console.log(`${label} tx sent: ${tx.hash}`);
  const receipt = await tx.wait(1);
  console.log(`${label} confirmed in block ${receipt.blockNumber}`);

  console.log(`Waiting 2 seconds for node stability...`);
  await new Promise(resolve => setTimeout(resolve, 2000));

  return receipt;
}

function isMainnet(networkName) {
  return ["ethereum", "base", "arbitrum", "polygon"].includes(networkName);
}

async function main() {
  console.log("Deploying BlocTime Protocol...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Network:", hre.network.name);

  const networkName = hre.network.name;
  const mainnet = isMainnet(networkName);

  let usdcAddress, usdtAddress, daiAddress;

  // ========== TOKENS ==========

  if (mainnet) {
    const tokens = CHAIN_TOKENS[networkName];
    if (!tokens) {
      throw new Error(`No token addresses configured for network: ${networkName}`);
    }
    usdtAddress = tokens.USDT;
    usdcAddress = tokens.USDC;
    daiAddress = tokens.DAI;
    console.log("\nUsing REAL mainnet token addresses:");
    console.log("USDT:", usdtAddress);
    console.log("USDC:", usdcAddress);
    console.log("DAI:", daiAddress);
  } else {
    console.log("\nDeploying MOCK tokens for testing...");

    const Token = await hre.ethers.getContractFactory("Token");

    let nonce = await deployer.getNonce('pending');
    const usdtDeployTx = await Token.deploy("Tether USD", "USDT", hre.ethers.parseEther("1000000"), { nonce });
    await sendAndConfirm(usdtDeployTx.deploymentTransaction(), "Mock USDT deploy");
    usdtAddress = await usdtDeployTx.getAddress();
    console.log("Mock USDT deployed to:", usdtAddress);

    nonce = await deployer.getNonce('pending');
    const usdcDeployTx = await Token.deploy("USD Coin", "USDC", hre.ethers.parseEther("1000000"), { nonce });
    await sendAndConfirm(usdcDeployTx.deploymentTransaction(), "Mock USDC deploy");
    usdcAddress = await usdcDeployTx.getAddress();
    console.log("Mock USDC deployed to:", usdcAddress);

    nonce = await deployer.getNonce('pending');
    const daiDeployTx = await Token.deploy("Dai Stablecoin", "DAI", hre.ethers.parseEther("1000000"), { nonce });
    await sendAndConfirm(daiDeployTx.deploymentTransaction(), "Mock DAI deploy");
    daiAddress = await daiDeployTx.getAddress();
    console.log("Mock DAI deployed to:", daiAddress);
  }

  // ========== ORACLE ==========

  let oracleAddress, oracle;
  const useChainlink = mainnet && CHAINLINK_ETH_USD[networkName];

  if (useChainlink) {
    // Deploy ChainlinkAdapter for mainnet
    console.log("\nDeploying Chainlink Oracle Adapter...");
    const ChainlinkAdapter = await hre.ethers.getContractFactory("ChainlinkAdapter");
    const chainlinkDeployTx = await ChainlinkAdapter.deploy();
    await sendAndConfirm(chainlinkDeployTx.deploymentTransaction(), "ChainlinkAdapter deploy");
    oracle = chainlinkDeployTx;
    oracleAddress = await oracle.getAddress();
    console.log("ChainlinkAdapter deployed to:", oracleAddress);

    // Set ETH/USD price feed
    console.log("\nSetting Chainlink price feeds...");
    let nonce = await deployer.getNonce('pending');
    await sendAndConfirm(oracle.setPriceFeed(ETH_SENTINEL, CHAINLINK_ETH_USD[networkName], { nonce }), "ETH/USD feed set");
    console.log("ETH/USD feed:", CHAINLINK_ETH_USD[networkName]);

    // Set stablecoin price feeds where available
    const stableFeeds = CHAINLINK_STABLE_USD[networkName] || {};
    if (stableFeeds.USDT) {
      nonce = await deployer.getNonce('pending');
      await sendAndConfirm(oracle.setPriceFeed(usdtAddress, stableFeeds.USDT, { nonce }), "USDT/USD feed set");
    }
    if (stableFeeds.USDC) {
      nonce = await deployer.getNonce('pending');
      await sendAndConfirm(oracle.setPriceFeed(usdcAddress, stableFeeds.USDC, { nonce }), "USDC/USD feed set");
    }
    if (stableFeeds.DAI) {
      nonce = await deployer.getNonce('pending');
      await sendAndConfirm(oracle.setPriceFeed(daiAddress, stableFeeds.DAI, { nonce }), "DAI/USD feed set");
    }

    // For stables without Chainlink feeds on this chain, deploy a ManualPriceOracle as fallback
    const missingFeeds = [];
    if (!stableFeeds.USDT) missingFeeds.push({ name: "USDT", addr: usdtAddress });
    if (!stableFeeds.USDC) missingFeeds.push({ name: "USDC", addr: usdcAddress });
    if (!stableFeeds.DAI) missingFeeds.push({ name: "DAI", addr: daiAddress });

    if (missingFeeds.length > 0) {
      console.log(`\nDeploying ManualPriceOracle for ${missingFeeds.map(f => f.name).join(", ")} (no Chainlink feed on ${networkName})...`);
      const ManualPriceOracle = await hre.ethers.getContractFactory("ManualPriceOracle");
      nonce = await deployer.getNonce('pending');
      const manualOracleDeployTx = await ManualPriceOracle.deploy({ nonce });
      await sendAndConfirm(manualOracleDeployTx.deploymentTransaction(), "ManualPriceOracle deploy");
      const manualOracle = manualOracleDeployTx;
      const manualOracleAddress = await manualOracle.getAddress();
      console.log("ManualPriceOracle deployed to:", manualOracleAddress);

      const usdPrice = 100000000n; // $1.00 with 8 decimals
      for (const feed of missingFeeds) {
        nonce = await deployer.getNonce('pending');
        await sendAndConfirm(manualOracle.setPrice(feed.addr, usdPrice, 8, { nonce }), `${feed.name} manual price set`);
      }
      // We'll register this as token-specific oracle in TokenGate later
      // Store for later use
      oracle._manualOracle = manualOracle;
      oracle._manualOracleAddress = manualOracleAddress;
      oracle._manualTokens = missingFeeds;
    }
  } else {
    // Testnet/local: use ManualPriceOracle for everything
    console.log("\nDeploying Manual Price Oracle...");
    const ManualPriceOracle = await hre.ethers.getContractFactory("ManualPriceOracle");
    const oracleDeployTx = await ManualPriceOracle.deploy();
    await sendAndConfirm(oracleDeployTx.deploymentTransaction(), "ManualPriceOracle deploy");
    oracle = oracleDeployTx;
    oracleAddress = await oracle.getAddress();
    console.log("Manual Price Oracle deployed to:", oracleAddress);

    console.log("\nSetting 1:1 oracle prices...");
    const usdPrice = 100000000n; // $1.00 with 8 decimals

    let nonce = await deployer.getNonce('pending');
    await sendAndConfirm(oracle.setPrice(usdcAddress, usdPrice, 8, { nonce }), "USDC price set");

    nonce = await deployer.getNonce('pending');
    await sendAndConfirm(oracle.setPrice(usdtAddress, usdPrice, 8, { nonce }), "USDT price set");

    nonce = await deployer.getNonce('pending');
    await sendAndConfirm(oracle.setPrice(daiAddress, usdPrice, 8, { nonce }), "DAI price set");

    // Set ETH price for mintWithETH (testnet: use ~$3000)
    const ethPrice = 300000000000n; // $3000.00 with 8 decimals
    nonce = await deployer.getNonce('pending');
    await sendAndConfirm(oracle.setPrice(ETH_SENTINEL, ethPrice, 8, { nonce }), "ETH price set");

    console.log("USDC, USDT & DAI prices set to $1.00, ETH set to $3000.00");
  }

  // ========== TOKENGATE ==========

  console.log("\nDeploying TokenGate...");
  const TokenGate = await hre.ethers.getContractFactory("TokenGate");
  const tokenGateDeployTx = await TokenGate.deploy(oracleAddress);
  await sendAndConfirm(tokenGateDeployTx.deploymentTransaction(), "TokenGate deploy");
  const tokenGate = tokenGateDeployTx;
  const tokenGateAddress = await tokenGate.getAddress();
  console.log("TokenGate deployed to:", tokenGateAddress);

  // Register token-specific manual oracles for mainnet stables without Chainlink feeds
  if (oracle._manualTokens && oracle._manualTokens.length > 0) {
    console.log("\nRegistering manual oracle for tokens without Chainlink feeds...");
    for (const feed of oracle._manualTokens) {
      let nonce = await deployer.getNonce('pending');
      await sendAndConfirm(tokenGate.registerTokenOracle(feed.addr, oracle._manualOracleAddress, { nonce }), `${feed.name} token oracle registered`);
    }
  }

  console.log("\nWhitelisting tokens in TokenGate...");
  let nonce = await deployer.getNonce('pending');
  await sendAndConfirm(tokenGate.whitelistToken(usdcAddress, { nonce }), "USDC whitelist");

  nonce = await deployer.getNonce('pending');
  await sendAndConfirm(tokenGate.whitelistToken(usdtAddress, { nonce }), "USDT whitelist");

  nonce = await deployer.getNonce('pending');
  await sendAndConfirm(tokenGate.whitelistToken(daiAddress, { nonce }), "DAI whitelist");

  nonce = await deployer.getNonce('pending');
  await sendAndConfirm(tokenGate.whitelistToken(ETH_SENTINEL, { nonce }), "ETH sentinel whitelist");

  console.log("USDC, USDT, DAI & ETH whitelisted");

  // ========== NATIVE TOKEN ==========

  console.log("\nDeploying Native Token...");
  const Token = await hre.ethers.getContractFactory("Token");
  const nativeTokenDeployTx = await Token.deploy("Native Token", "NAT", hre.ethers.parseEther("1000000"));
  await sendAndConfirm(nativeTokenDeployTx.deploymentTransaction(), "Native Token deploy");
  const nativeToken = nativeTokenDeployTx;
  const nativeTokenAddress = await nativeToken.getAddress();
  console.log("Native Token deployed to:", nativeTokenAddress);

  // ========== BLOCTIME ==========

  console.log("\nDeploying BlocTime...");
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

  console.log("\nSetting multiplier points...");
  const points = [
    { blocks: 0, multiplier: 10000 },
    { blocks: 10000, multiplier: 15000 },
    { blocks: 50000, multiplier: 20000 },
    { blocks: 100000, multiplier: 30000 },
  ];
  nonce = await deployer.getNonce('pending');
  await sendAndConfirm(blocTime.setPoints(points, { nonce }), "Multiplier points set");
  console.log("Multiplier points set successfully");

  // ========== REGISTRY ==========

  console.log("\nDeploying Registry...");
  const Registry = await hre.ethers.getContractFactory("Registry");
  const registryDeployTx = await Registry.deploy();
  await sendAndConfirm(registryDeployTx.deploymentTransaction(), "Registry deploy");
  const registry = registryDeployTx;
  const registryAddress = await registry.getAddress();
  console.log("Registry deployed to:", registryAddress);

  // ========== TREASURY ==========

  console.log("\nDeploying Treasury...");
  const Treasury = await hre.ethers.getContractFactory("Treasury");
  const treasuryDeployTx = await Treasury.deploy(2000, tokenGateAddress);
  await sendAndConfirm(treasuryDeployTx.deploymentTransaction(), "Treasury deploy");
  const treasury = treasuryDeployTx;
  const treasuryAddress = await treasury.getAddress();
  console.log("Treasury deployed to:", treasuryAddress);

  nonce = await deployer.getNonce('pending');
  await sendAndConfirm(treasury.setGovernanceToken(blocTimeAddress, { nonce }), "Governance token set");
  console.log("Governance token set to BlocTime");

  // ========== MARKET ==========

  console.log("\nDeploying Market...");
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

  // ========== DEBIT ==========

  console.log("\nDeploying Debit...");
  const Debit = await hre.ethers.getContractFactory("Debit");
  const debitDeployTx = await Debit.deploy(marketAddress);
  await sendAndConfirm(debitDeployTx.deploymentTransaction(), "Debit deploy");
  const debit = debitDeployTx;
  const debitAddress = await debit.getAddress();
  console.log("Debit deployed to:", debitAddress);

  console.log("\nAuthorizing Debit contract on Market...");
  nonce = await deployer.getNonce('pending');
  await sendAndConfirm(market.setDebitContract(debitAddress, { nonce }), "Debit contract authorized");
  console.log("Debit contract authorized on Market");

  // ========== SAVE CONFIG ==========

  const chainId = (await hre.ethers.provider.getNetwork()).chainId.toString();
  const configPath = path.join(__dirname, "..", "config.json");

  let existingConfig = { deployments: {} };
  if (fs.existsSync(configPath)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      existingConfig.deployments = existingConfig.deployments || {};
    } catch (e) {
      console.warn("Could not parse config.json - creating new");
    }
  }

  const oracleContract = useChainlink ? "ChainlinkAdapter" : "ManualPriceOracle";

  existingConfig.deployments[networkName] = {
    chainId,
    deployer: deployer.address,
    url: hre.network.config.url || "",
    contracts: {
      USDC: { address: usdcAddress, contract: mainnet ? "ERC20" : "Token" },
      USDT: { address: usdtAddress, contract: mainnet ? "ERC20" : "Token" },
      DAI: { address: daiAddress, contract: mainnet ? "ERC20" : "Token" },
      ETH_SENTINEL: { address: ETH_SENTINEL, note: "Native ETH mint sentinel" },
      Oracle: { address: oracleAddress, contract: oracleContract },
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
  console.log("\nDeployment addresses saved to config.json");

  console.log("\n--- Deployment Summary ---");
  console.log("Network:", networkName);
  console.log("Chain ID:", chainId);
  console.log("Deployer:", deployer.address);
  console.log("Oracle:", oracleContract, "at", oracleAddress);
  console.log("USDC:", usdcAddress);
  console.log("USDT:", usdtAddress);
  console.log("DAI:", daiAddress);
  console.log("ETH Sentinel:", ETH_SENTINEL);
  console.log("TokenGate:", tokenGateAddress);
  console.log("Native Token:", nativeTokenAddress);
  console.log("BlocTime:", blocTimeAddress);
  console.log("Registry:", registryAddress);
  console.log("Treasury:", treasuryAddress);
  console.log("Market:", marketAddress);
  console.log("Debit:", debitAddress);
  console.log("\nMint functions ready:");
  console.log("  market.mint(tokenAddress, amount) - mint with USDT/USDC/DAI");
  console.log("  market.mintWithETH{value: amount}() - mint with native ETH");
  console.log("\nDeployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
