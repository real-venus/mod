const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function sendAndConfirm(txPromise, label = "Transaction") {
  const tx = await txPromise;
  console.log(`${label} tx sent: ${tx.hash}`);
  const receipt = await tx.wait(1);
  console.log(`${label} confirmed in block ${receipt.blockNumber}`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  return receipt;
}

async function main() {
  console.log("Deploying EvoCoin Protocol...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name);

  const initialSupply = hre.ethers.parseEther("10000000");

  // 1. EvoToken
  console.log("\nDeploying EvoToken...");
  const EvoToken = await hre.ethers.getContractFactory("EvoToken");
  let nonce = await deployer.getNonce("pending");
  const evoToken = await EvoToken.deploy(initialSupply, { nonce });
  await sendAndConfirm(evoToken.deploymentTransaction(), "EvoToken");
  const evoTokenAddr = await evoToken.getAddress();
  console.log("EvoToken:", evoTokenAddr);

  // 2. HubExchange
  console.log("\nDeploying HubExchange...");
  nonce = await deployer.getNonce("pending");
  const HubExchange = await hre.ethers.getContractFactory("HubExchange");
  const exchange = await HubExchange.deploy(evoTokenAddr, { nonce });
  await sendAndConfirm(exchange.deploymentTransaction(), "HubExchange");
  const exchangeAddr = await exchange.getAddress();
  console.log("HubExchange:", exchangeAddr);

  // 3. EvoRegistry
  console.log("\nDeploying EvoRegistry...");
  nonce = await deployer.getNonce("pending");
  const EvoRegistry = await hre.ethers.getContractFactory("EvoRegistry");
  const registry = await EvoRegistry.deploy({ nonce });
  await sendAndConfirm(registry.deploymentTransaction(), "EvoRegistry");
  const registryAddr = await registry.getAddress();
  console.log("EvoRegistry:", registryAddr);

  // 4. TokenFactory
  console.log("\nDeploying TokenFactory...");
  nonce = await deployer.getNonce("pending");
  const TokenFactory = await hre.ethers.getContractFactory("TokenFactory");
  const factory = await TokenFactory.deploy(exchangeAddr, registryAddr, evoTokenAddr, 0, { nonce });
  await sendAndConfirm(factory.deploymentTransaction(), "TokenFactory");
  const factoryAddr = await factory.getAddress();
  console.log("TokenFactory:", factoryAddr);

  // 5. Configure
  console.log("\nConfiguring...");
  nonce = await deployer.getNonce("pending");
  await sendAndConfirm(exchange.setFactory(factoryAddr, { nonce }), "Exchange.setFactory");
  nonce = await deployer.getNonce("pending");
  await sendAndConfirm(registry.setFactory(factoryAddr, { nonce }), "Registry.setFactory");

  // Save config
  const chainId = (await hre.ethers.provider.getNetwork()).chainId.toString();
  const configPath = path.join(__dirname, "..", "config.json");

  let config = {};
  if (fs.existsSync(configPath)) {
    try { config = JSON.parse(fs.readFileSync(configPath, "utf8")); } catch {}
  }

  config.engine = config.engine || { port: 8420, log_level: "info" };
  config.chain_id = chainId;
  config.network = hre.network.name;
  config.deployer = deployer.address;
  config.contracts = {
    EvoToken: { address: evoTokenAddr, contract: "EvoToken" },
    HubExchange: { address: exchangeAddr, contract: "HubExchange" },
    EvoRegistry: { address: registryAddr, contract: "EvoRegistry" },
    TokenFactory: { address: factoryAddr, contract: "TokenFactory" },
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("\nSaved to config.json");

  console.log("\n--- Deployment Summary ---");
  console.log("EvoToken:", evoTokenAddr);
  console.log("HubExchange:", exchangeAddr);
  console.log("EvoRegistry:", registryAddr);
  console.log("TokenFactory:", factoryAddr);
  console.log("Done!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => { console.error(error); process.exit(1); });
