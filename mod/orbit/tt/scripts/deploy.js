const hre = require("hardhat");

async function main() {
  // Deploy NativeToken (1M supply)
  const initialSupply = hre.ethers.parseEther("1000000");
  const NativeToken = await hre.ethers.getContractFactory("NativeToken");
  const nativeToken = await NativeToken.deploy(initialSupply);
  await nativeToken.waitForDeployment();
  const nativeTokenAddress = await nativeToken.getAddress();
  console.log(`NativeToken deployed to: ${nativeTokenAddress}`);

  // StakeTime params
  const maxLockBlocks = 100000;
  const maxStakersPerValidator = 100;
  const defaultCommissionBps = 1000;   // 10%
  const epochLength = 43200;           // ~1 day on Base

  // Deploy StakeTime (staking primitive)
  const StakeTime = await hre.ethers.getContractFactory("StakeTime");
  const stakeTime = await StakeTime.deploy(
    nativeTokenAddress,
    maxLockBlocks,
    maxStakersPerValidator,
    defaultCommissionBps,
    epochLength
  );
  await stakeTime.waitForDeployment();
  const stakeTimeAddress = await stakeTime.getAddress();
  console.log(`StakeTime deployed to: ${stakeTimeAddress}`);

  // Incentive params
  const emissionRate = hre.ethers.parseEther("100"); // 100 tokens per epoch
  const decayBps = 500;                              // 5% decay

  // Deploy Subnet (emission layer)
  const Subnet = await hre.ethers.getContractFactory("Subnet");
  const incentive = await Subnet.deploy(
    stakeTimeAddress,
    nativeTokenAddress,
    emissionRate,
    decayBps,
    epochLength
  );
  await incentive.waitForDeployment();
  const incentiveAddress = await incentive.getAddress();
  console.log(`Subnet deployed to: ${incentiveAddress}`);

  // Transfer StakeTime ownership to Subnet (so it can advanceEpoch)
  await stakeTime.transferOwnership(incentiveAddress);
  console.log(`StakeTime ownership transferred to Subnet`);

  // Fund Subnet with emission tokens
  const fundAmount = hre.ethers.parseEther("500000");
  await nativeToken.transfer(incentiveAddress, fundAmount);
  console.log(`Funded Subnet with ${hre.ethers.formatEther(fundAmount)} NTV for emissions`);

  // Deploy Registry (subnet registry with 420 cap, NativeToken lock)
  const immunityPeriod = 43200; // ~1 day on Base (same as epoch)
  const registrationCost = hre.ethers.parseEther("1000"); // 1000 NTV to register a subnet
  const Registry = await hre.ethers.getContractFactory("Registry");
  const registry = await Registry.deploy(immunityPeriod, nativeTokenAddress, registrationCost);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`Registry deployed to: ${registryAddress}`);

  // Approve and register initial subnet (subnet #0)
  await nativeToken.approve(registryAddress, registrationCost);
  await registry.registerSubnet("genesis", stakeTimeAddress, incentiveAddress);
  console.log(`Genesis subnet registered in Registry (locked ${hre.ethers.formatEther(registrationCost)} NTV)`);

  // Write deployment info
  const fs = require("fs");
  const path = require("path");
  const info = {
    nativeToken: nativeTokenAddress,
    stakeTime: stakeTimeAddress,
    incentive: incentiveAddress,
    registry: registryAddress,
    address: stakeTimeAddress, // primary
    network: hre.network.name,
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
  fs.writeFileSync(
    path.join(__dirname, "..", "config.json"),
    JSON.stringify(info, null, 2)
  );
  console.log("Deployment info saved to config.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
