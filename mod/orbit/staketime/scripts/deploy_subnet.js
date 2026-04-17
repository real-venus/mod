/**
 * Deploy a single subnet: Subnet ERC20 + Staking + Consensus + register in Registry.
 *
 * Supports consensus types: yuma (default), linear, staked
 *
 * Usage:
 *   SUBNET_PARAMS='{"name":"MyNet","symbol":"MNT","consensusType":"yuma",...}' \
 *   npx hardhat run scripts/deploy_subnet.js --network base_sepolia
 */
const hre = require("hardhat");

async function main() {
  const raw = process.env.SUBNET_PARAMS;
  if (!raw) throw new Error("SUBNET_PARAMS env var required (JSON)");

  const params = JSON.parse(raw);
  const {
    name,
    symbol,
    initialSupply = "1000000",
    maxLockBlocks = 100000,
    maxStakersPerValidator = 100,
    defaultCommissionBps = 1000,
    epochLength = 43200,
    emissionRate = "100",
    decayBps = 500,
    consensusType = "yuma",
    registryAddress,
  } = params;

  if (!name || !symbol) throw new Error("name and symbol required");
  if (!registryAddress) throw new Error("registryAddress required");

  const validTypes = ["yuma", "linear", "staked"];
  if (!validTypes.includes(consensusType)) {
    throw new Error(`Invalid consensusType: ${consensusType}. Must be one of: ${validTypes.join(", ")}`);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying subnet "${name}" (${symbol}) [${consensusType}] with: ${deployer.address}`);

  let nonce = await deployer.getNonce();
  const send = (opts) => ({ ...opts, nonce: nonce++ });

  // 1. Deploy Subnet ERC20
  const supply = hre.ethers.parseEther(initialSupply);
  const Subnet = await hre.ethers.getContractFactory("Subnet");
  const subnet = await Subnet.deploy(name, symbol, supply, send({}));
  await subnet.waitForDeployment();
  const subnetAddress = await subnet.getAddress();
  console.log(`Subnet token deployed: ${subnetAddress}`);

  // 2. Deploy StakeTime (ERC20 + staking)
  const StakeTime = await hre.ethers.getContractFactory("StakeTime");
  const staking = await StakeTime.deploy(
    subnetAddress,
    maxLockBlocks,
    maxStakersPerValidator,
    defaultCommissionBps,
    send({})
  );
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log(`StakeTime (STT) deployed: ${stakingAddress}`);

  // 3. Deploy Consensus (selected type)
  const emRate = hre.ethers.parseEther(emissionRate);
  let consensus;
  const contractNames = {
    yuma: "ConsensusYuma",
    linear: "ConsensusLinear",
    staked: "ConsensusStaked",
  };
  const factoryName = contractNames[consensusType];
  const Factory = await hre.ethers.getContractFactory(factoryName);

  if (consensusType === "yuma") {
    // Yuma has an extra decayBps parameter
    consensus = await Factory.deploy(
      subnetAddress, stakingAddress, emRate, decayBps, epochLength, send({})
    );
  } else {
    // Linear and Staked share the same constructor
    consensus = await Factory.deploy(
      subnetAddress, stakingAddress, emRate, epochLength, send({})
    );
  }
  await consensus.waitForDeployment();
  const consensusAddress = await consensus.getAddress();
  console.log(`${factoryName} deployed: ${consensusAddress}`);

  // 4. Set consensus as minter
  await (await subnet.setMinter(consensusAddress, send({}))).wait();
  console.log(`Minter set to ${factoryName}`);

  // 5. Register in Registry
  const Registry = await hre.ethers.getContractFactory("Registry");
  const registry = Registry.attach(registryAddress);

  const govTokenAddr = await registry.governanceToken();
  const GovToken = await hre.ethers.getContractFactory("Subnet");
  const govToken = GovToken.attach(govTokenAddr);

  const cost = await registry.registrationCost();
  if (cost > 0n) {
    await (await govToken.approve(registryAddress, cost, send({}))).wait();
    console.log(`Approved ${hre.ethers.formatEther(cost)} GOV for registration`);
  }

  const tx = await registry.registerSubnet(name, subnetAddress, stakingAddress, consensusAddress, send({}));
  const receipt = await tx.wait();
  console.log(`Subnet registered in Registry (tx: ${receipt.hash})`);

  const result = {
    subnet: subnetAddress,
    staking: stakingAddress,
    consensus: consensusAddress,
    consensusType,
    name,
    symbol,
    initialSupply,
    maxLockBlocks,
    maxStakersPerValidator,
    defaultCommissionBps,
    epochLength,
    emissionRate,
    decayBps,
    tx: receipt.hash,
  };

  console.log(`\n__RESULT__${JSON.stringify(result)}__END__`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
