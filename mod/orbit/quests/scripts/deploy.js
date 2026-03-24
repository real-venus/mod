const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with:', deployer.address);

  // Deploy a test ERC20 token (or use existing Market token address)
  const Token = await ethers.getContractFactory('TestToken');
  const token = await Token.deploy('USD Coin', 'USDC', ethers.parseUnits('1000000', 8));
  await token.waitForDeployment();
  console.log('TestToken:', await token.getAddress());

  await new Promise(r => setTimeout(r, 2000));

  // Deploy QuestBoard
  const QuestBoard = await ethers.getContractFactory('QuestBoard');
  const questBoard = await QuestBoard.deploy(
    await token.getAddress(),
    deployer.address // treasury = deployer for now
  );
  await questBoard.waitForDeployment();
  console.log('QuestBoard:', await questBoard.getAddress());

  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
