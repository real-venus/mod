const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying with: ${deployer.address}`);

  let nonce = await deployer.getNonce();
  const send = (opts) => ({ ...opts, nonce: nonce++ });

  // ── 1. Deploy Subnet ERC20 token (1M initial supply) ──────────────
  const initialSupply = hre.ethers.parseEther("1000000");
  const Subnet = await hre.ethers.getContractFactory("Subnet");
  const subnet = await Subnet.deploy("StakeTimeNet", "STN", initialSupply, send({}));
  await subnet.waitForDeployment();
  const subnetAddress = await subnet.getAddress();
  console.log(`Subnet (ERC20) deployed to: ${subnetAddress}`);

  // ── 2. Deploy StakeTime (consensus mechanism) ───────────────────
  const maxLockBlocks = 100000;
  const maxStakersPerValidator = 100;
  const defaultCommissionBps = 1000;   // 10%
  const epochLength = 43200;           // ~1 day on Base
  const emissionRate = hre.ethers.parseEther("100"); // 100 tokens per epoch
  const decayBps = 500;                              // 5% decay

  const StakeTime = await hre.ethers.getContractFactory("StakeTime");
  const stakeTime = await StakeTime.deploy(
    subnetAddress,       // nativeToken (staked token)
    subnetAddress,       // subnet (emission token)
    maxLockBlocks,
    maxStakersPerValidator,
    defaultCommissionBps,
    epochLength,
    emissionRate,
    decayBps,
    send({})
  );
  await stakeTime.waitForDeployment();
  const stakeTimeAddress = await stakeTime.getAddress();
  console.log(`StakeTime deployed to: ${stakeTimeAddress}`);

  // ── 3. Wire permissions ─────────────────────────────────────────
  // StakeTime mints new Subnet tokens for emissions
  await (await subnet.setMinter(stakeTimeAddress, send({}))).wait();
  console.log(`Subnet minter set to StakeTime`);

  // ── 4. Deploy governance token for Registry ─────────────────────
  const govToken = await Subnet.deploy("Governance", "GOV", hre.ethers.parseEther("10000000"), send({}));
  await govToken.waitForDeployment();
  const govTokenAddress = await govToken.getAddress();
  console.log(`Governance token deployed to: ${govTokenAddress}`);

  // ── 5. Deploy Registry ──────────────────────────────────────────
  const immunityPeriod = 43200;
  const registrationCost = hre.ethers.parseEther("1000");

  const Registry = await hre.ethers.getContractFactory("Registry");
  const registry = await Registry.deploy(immunityPeriod, govTokenAddress, registrationCost, send({}));
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`Registry deployed to: ${registryAddress}`);

  // ── 6. Register genesis subnet ──────────────────────────────────
  // StakeTime IS the consensus — pass same address for both stakeTime and consensus
  await (await govToken.approve(registryAddress, registrationCost, send({}))).wait();
  await (await registry.registerSubnet("genesis", subnetAddress, stakeTimeAddress, stakeTimeAddress, send({}))).wait();
  console.log(`Genesis subnet registered (locked ${hre.ethers.formatEther(registrationCost)} GOV)`);

  // ── 7. Save deployment info (network-specific) ─────────────────
  const fs = require("fs");
  const path = require("path");
  const configPath = path.join(__dirname, "..", "config.json");
  const network = hre.network.name;

  let config = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }

  if (!config.contracts) config.contracts = {};
  config.contracts[network] = {
    subnet: subnetAddress,
    stakeTime: stakeTimeAddress,
    governanceToken: govTokenAddress,
    registry: registryAddress,
    address: subnetAddress,
    chainId: hre.network.config.chainId,
    emissionRate: emissionRate.toString(),
    decayBps,
    epochLength,
    immunityPeriod,
    registrationCost: registrationCost.toString(),
    maxLockBlocks,
    maxStakersPerValidator,
    defaultCommissionBps,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`Deployment info saved to config.json [${network}]`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
