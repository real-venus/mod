const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

/**
 * Deploy full BlocTime protocol with N-of-M Safe multisig ownership.
 *
 * Usage:
 *   OWNERS=0x...,0x...,0x... [THRESHOLD=2] npx hardhat run scripts/deploySafeProtocol.js --network <network>
 *
 * The deployer (first signer) is always included as an owner.
 * OWNERS: comma-separated list of additional owner addresses (can also include deployer).
 * THRESHOLD: number of required signatures (default: ceil(totalOwners / 2)).
 */

const MAINNET_ADDRESSES = {
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
};

async function sendAndConfirm(txPromise, label = 'Transaction') {
  const tx = await txPromise;
  console.log(`${label} tx sent: ${tx.hash}`);
  const receipt = await tx.wait(1);
  console.log(`${label} confirmed in block ${receipt.blockNumber}`);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return receipt;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  // Build owners list: deployer + any additional from OWNERS env
  const extraOwners = process.env.OWNERS
    ? process.env.OWNERS.split(',').map((a) => a.trim()).filter(Boolean)
    : [];
  // Deduplicate: deployer is always first, then extras that aren't the deployer
  const owners = [
    deployer.address,
    ...extraOwners.filter((a) => a.toLowerCase() !== deployer.address.toLowerCase()),
  ];

  if (owners.length < 1) {
    console.error('No owners resolved. At minimum the deployer is an owner.');
    process.exit(1);
  }

  // Threshold: user-specified or ceil(n/2)
  const threshold = process.env.THRESHOLD
    ? parseInt(process.env.THRESHOLD, 10)
    : Math.ceil(owners.length / 2);

  if (threshold < 1 || threshold > owners.length) {
    console.error(`Invalid threshold ${threshold} for ${owners.length} owners. Must be 1..${owners.length}`);
    process.exit(1);
  }

  console.log(`Deploying BlocTime Protocol with Safe Multisig (${threshold}-of-${owners.length})\n`);
  console.log('Network:', hre.network.name);
  owners.forEach((o, i) => console.log(`Owner${i + 1}:`, o));
  console.log('Threshold:', threshold);
  console.log('Balance:', hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), 'ETH\n');

  // --- Step 1: Deploy Safe infrastructure ---
  console.log('--- Deploying Safe Infrastructure ---\n');

  const Safe = await hre.ethers.getContractFactory('Safe');
  const safeSingleton = await Safe.deploy();
  await sendAndConfirm(safeSingleton.deploymentTransaction(), 'Safe singleton deploy');
  const singletonAddress = await safeSingleton.getAddress();
  console.log('Safe singleton:', singletonAddress);

  const SafeProxyFactory = await hre.ethers.getContractFactory('SafeProxyFactory');
  const proxyFactory = await SafeProxyFactory.deploy();
  await sendAndConfirm(proxyFactory.deploymentTransaction(), 'SafeProxyFactory deploy');
  const factoryAddress = await proxyFactory.getAddress();
  console.log('SafeProxyFactory:', factoryAddress);

  // Create N-of-M Safe
  const setupData = Safe.interface.encodeFunctionData('setup', [
    owners,
    threshold,
    hre.ethers.ZeroAddress,
    '0x',
    hre.ethers.ZeroAddress,
    hre.ethers.ZeroAddress,
    0,
    hre.ethers.ZeroAddress,
  ]);

  const saltNonce = Date.now();
  const createTx = await proxyFactory.createProxyWithNonce(singletonAddress, setupData, saltNonce);
  const createReceipt = await sendAndConfirm(Promise.resolve(createTx), 'Safe proxy creation');

  const event = createReceipt.logs.find(
    (log) => log.topics[0] === proxyFactory.interface.getEvent('ProxyCreation').topicHash
  );
  const safeAddress = '0x' + event.topics[1].slice(26);

  // Verify
  const safeProxy = await hre.ethers.getContractAt('Safe', safeAddress);
  const actualOwners = await safeProxy.getOwners();
  const actualThreshold = await safeProxy.getThreshold();
  console.log('\nSafe proxy:', safeAddress);
  console.log('Owners:', actualOwners);
  console.log('Threshold:', actualThreshold.toString(), 'of', actualOwners.length);

  // --- Step 2: Deploy protocol contracts ---
  console.log('\n--- Deploying Protocol Contracts ---\n');

  let usdcAddress, usdtAddress;

  if (hre.network.name === 'mainnet' || hre.network.name === 'base_mainnet') {
    usdtAddress = MAINNET_ADDRESSES.USDT;
    usdcAddress = MAINNET_ADDRESSES.USDC;
    console.log('Using mainnet USDT:', usdtAddress);
    console.log('Using mainnet USDC:', usdcAddress);
  } else {
    const Token = await hre.ethers.getContractFactory('Token');

    const usdt = await Token.deploy('Tether USD', 'USDT', hre.ethers.parseEther('1000000'));
    await sendAndConfirm(usdt.deploymentTransaction(), 'Mock USDT deploy');
    usdtAddress = await usdt.getAddress();
    console.log('Mock USDT:', usdtAddress);

    const usdc = await Token.deploy('USD Coin', 'USDC', hre.ethers.parseEther('1000000'));
    await sendAndConfirm(usdc.deploymentTransaction(), 'Mock USDC deploy');
    usdcAddress = await usdc.getAddress();
    console.log('Mock USDC:', usdcAddress);
  }

  // Oracle
  const ManualPriceOracle = await hre.ethers.getContractFactory('ManualPriceOracle');
  const oracle = await ManualPriceOracle.deploy();
  await sendAndConfirm(oracle.deploymentTransaction(), 'ManualPriceOracle deploy');
  const oracleAddress = await oracle.getAddress();
  console.log('ManualPriceOracle:', oracleAddress);

  const usdPrice = 100000000n;
  await sendAndConfirm(oracle.setPrice(usdcAddress, usdPrice, 8), 'USDC price set');
  await sendAndConfirm(oracle.setPrice(usdtAddress, usdPrice, 8), 'USDT price set');

  // TokenGate
  const TokenGate = await hre.ethers.getContractFactory('TokenGate');
  const tokenGate = await TokenGate.deploy(oracleAddress);
  await sendAndConfirm(tokenGate.deploymentTransaction(), 'TokenGate deploy');
  const tokenGateAddress = await tokenGate.getAddress();
  console.log('TokenGate:', tokenGateAddress);

  await sendAndConfirm(tokenGate.whitelistToken(usdcAddress), 'USDC whitelist');
  await sendAndConfirm(tokenGate.whitelistToken(usdtAddress), 'USDT whitelist');

  // Native Token
  const Token = await hre.ethers.getContractFactory('Token');
  const nativeToken = await Token.deploy('Native Token', 'NAT', hre.ethers.parseEther('1000000'));
  await sendAndConfirm(nativeToken.deploymentTransaction(), 'NativeToken deploy');
  const nativeTokenAddress = await nativeToken.getAddress();
  console.log('NativeToken:', nativeTokenAddress);

  // BlocTime
  const BlocTime = await hre.ethers.getContractFactory('BlocTime');
  const blocTime = await BlocTime.deploy(nativeTokenAddress, 'BlocTime Token', 'BLOC', 100000, 5000);
  await sendAndConfirm(blocTime.deploymentTransaction(), 'BlocTime deploy');
  const blocTimeAddress = await blocTime.getAddress();
  console.log('BlocTime:', blocTimeAddress);

  const points = [
    { blocks: 0, multiplier: 10000 },
    { blocks: 10000, multiplier: 15000 },
    { blocks: 50000, multiplier: 20000 },
    { blocks: 100000, multiplier: 30000 },
  ];
  await sendAndConfirm(blocTime.setPoints(points), 'Multiplier points set');

  // Registry
  const Registry = await hre.ethers.getContractFactory('Registry');
  const registry = await Registry.deploy();
  await sendAndConfirm(registry.deploymentTransaction(), 'Registry deploy');
  const registryAddress = await registry.getAddress();
  console.log('Registry:', registryAddress);

  // Treasury
  const Treasury = await hre.ethers.getContractFactory('Treasury');
  const treasury = await Treasury.deploy(2000, tokenGateAddress);
  await sendAndConfirm(treasury.deploymentTransaction(), 'Treasury deploy');
  const treasuryAddress = await treasury.getAddress();
  console.log('Treasury:', treasuryAddress);
  await sendAndConfirm(treasury.setGovernanceToken(blocTimeAddress), 'Governance token set');

  // Market
  const Market = await hre.ethers.getContractFactory('Market');
  const market = await Market.deploy('BlocTime Market Token', 'BTMT', treasuryAddress, tokenGateAddress);
  await sendAndConfirm(market.deploymentTransaction(), 'Market deploy');
  const marketAddress = await market.getAddress();
  console.log('Market:', marketAddress);

  // Debit
  const Debit = await hre.ethers.getContractFactory('Debit');
  const debit = await Debit.deploy(marketAddress);
  await sendAndConfirm(debit.deploymentTransaction(), 'Debit deploy');
  const debitAddress = await debit.getAddress();
  console.log('Debit:', debitAddress);
  await sendAndConfirm(market.setDebitContract(debitAddress), 'Debit contract authorized');

  // --- Step 3: Transfer ownership to Safe ---
  console.log('\n--- Transferring Ownership to Safe ---\n');

  await sendAndConfirm(oracle.transferOwnership(safeAddress), 'Oracle ownership transfer');
  await sendAndConfirm(tokenGate.transferOwnership(safeAddress), 'TokenGate ownership transfer');
  await sendAndConfirm(blocTime.transferOwnership(safeAddress), 'BlocTime ownership transfer');
  await sendAndConfirm(treasury.transferOwnership(safeAddress), 'Treasury ownership transfer');
  await sendAndConfirm(market.transferOwnership(safeAddress), 'Market ownership transfer');
  await sendAndConfirm(debit.transferOwnership(safeAddress), 'Debit ownership transfer');

  console.log('All contract ownership transferred to Safe');

  // --- Save config ---
  const chainId = (await hre.ethers.provider.getNetwork()).chainId.toString();
  const networkName = hre.network.name;
  const configPath = path.join(__dirname, '..', 'config.json');

  let existingConfig = { deployments: {} };
  if (fs.existsSync(configPath)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      existingConfig.deployments = existingConfig.deployments || {};
    } catch (e) {
      console.warn('Could not parse config.json – creating new');
    }
  }

  existingConfig.deployments[networkName] = {
    chainId,
    deployer: deployer.address,
    url: hre.network.config.url || '',
    safe: {
      singleton: singletonAddress,
      proxyFactory: factoryAddress,
      proxy: safeAddress,
      owners,
      threshold,
    },
    contracts: {
      USDC: { address: usdcAddress, contract: 'Token', owner: safeAddress },
      USDT: { address: usdtAddress, contract: 'Token', owner: safeAddress },
      ManualPriceOracle: { address: oracleAddress, contract: 'ManualPriceOracle', owner: safeAddress },
      TokenGate: { address: tokenGateAddress, contract: 'TokenGate', owner: safeAddress },
      NativeToken: { address: nativeTokenAddress, contract: 'Token', owner: safeAddress },
      BlocTime: { address: blocTimeAddress, contract: 'BlocTime', owner: safeAddress },
      Registry: { address: registryAddress, contract: 'Registry' },
      Treasury: { address: treasuryAddress, contract: 'Treasury', owner: safeAddress },
      Market: { address: marketAddress, contract: 'Market', owner: safeAddress },
      Debit: { address: debitAddress, contract: 'Debit', owner: safeAddress },
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));
  console.log('\nConfig saved to config.json');

  // --- Summary ---
  console.log('\n=== Deployment Summary ===');
  console.log('Network:', networkName);
  console.log('Chain ID:', chainId);
  console.log(`\nSafe Multisig (${threshold}-of-${owners.length}):`);
  console.log('  Address:', safeAddress);
  owners.forEach((o, i) => console.log(`  Owner${i + 1}:`, o));
  console.log('\nContracts (owned by Safe):');
  console.log('  USDC:', usdcAddress);
  console.log('  USDT:', usdtAddress);
  console.log('  Oracle:', oracleAddress);
  console.log('  TokenGate:', tokenGateAddress);
  console.log('  NativeToken:', nativeTokenAddress);
  console.log('  BlocTime:', blocTimeAddress);
  console.log('  Registry:', registryAddress);
  console.log('  Treasury:', treasuryAddress);
  console.log('  Market:', marketAddress);
  console.log('  Debit:', debitAddress);
  console.log(`\nAll admin operations now require ${threshold}-of-${owners.length} multisig approval.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
