const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('BlocTimeIntegration Tests', function () {
  let owner, user1, user2;
  let nativeToken, staking, registry, marketplace, integration;
  const INITIAL_SUPPLY = ethers.parseEther('1000000');

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const BaseERC20 = await ethers.getContractFactory('BaseERC20');
    nativeToken = await BaseERC20.deploy('Native Token', 'NAT', INITIAL_SUPPLY);
    await nativeToken.waitForDeployment();

    const BlocTimeStaking = await ethers.getContractFactory('BlocTimeStaking');
    staking = await BlocTimeStaking.deploy(
      await nativeToken.getAddress(),
      'BlocTime Token',
      'BLOC',
      100000,
      5000
    );
    await staking.waitForDeployment();

    const points = [
      { blocks: 0, multiplier: 10000 },
      { blocks: 50000, multiplier: 20000 },
      { blocks: 100000, multiplier: 30000 }
    ];
    await staking.setPoints(points);

    const Registry = await ethers.getContractFactory('Registry');
    registry = await Registry.deploy();
    await registry.waitForDeployment();

    const BlocTimeMarketplaceV3 = await ethers.getContractFactory('BlocTimeMarketplaceV3');
    marketplace = await BlocTimeMarketplaceV3.deploy(
      await nativeToken.getAddress(),
      await staking.getAddress(),
      await registry.getAddress(),
      250
    );
    await marketplace.waitForDeployment();

    const BlocTimeIntegration = await ethers.getContractFactory('BlocTimeIntegration');
    integration = await BlocTimeIntegration.deploy(
      await marketplace.getAddress(),
      await registry.getAddress(),
      await staking.getAddress()
    );
    await integration.waitForDeployment();

    await nativeToken.transfer(user1.address, ethers.parseEther('10000'));
    await nativeToken.transfer(user2.address, ethers.parseEther('10000'));
  });

  describe('Health Check', function () {
    it('should return healthy status for all contracts', async function () {
      const [marketplaceHealthy, registryHealthy, stakingHealthy, status] = await integration.healthCheck();
      
      expect(marketplaceHealthy).to.be.true;
      expect(registryHealthy).to.be.true;
      expect(stakingHealthy).to.be.true;
      expect(status).to.equal('All systems operational');
    });
  });

  describe('System Statistics', function () {
    it('should return correct initial stats', async function () {
      const [totalModules, totalRentals, totalStaked, totalBlocTime, treasuryBalance] = 
        await integration.getSystemStats();
      
      expect(totalModules).to.equal(0);
      expect(totalRentals).to.equal(0);
      expect(totalStaked).to.equal(0);
      expect(totalBlocTime).to.equal(0);
      expect(treasuryBalance).to.equal(0);
    });

    it('should track stats after activity', async function () {
      // User1 stakes
      const stakeAmount = ethers.parseEther('1000');
      await nativeToken.connect(user1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(user1).stake(stakeAmount, 50000);

      // User2 registers module
      await registry.connect(user2).registerModule(ethers.parseEther('0.01'), 10, 'QmTest');

      // User1 rents module
      const cost = ethers.parseEther('0.01') * 1000n;
      await nativeToken.connect(user1).approve(await marketplace.getAddress(), cost);
      await marketplace.connect(user1).rent(1, 1000);

      const [totalModules, totalRentals, totalStaked, totalBlocTime, treasuryBalance] = 
        await integration.getSystemStats();
      
      expect(totalModules).to.equal(1);
      expect(totalRentals).to.equal(1);
      expect(totalStaked).to.equal(stakeAmount);
      expect(totalBlocTime).to.equal(stakeAmount * 2n);
      expect(treasuryBalance).to.be.gt(0);
    });
  });

  describe('User Info', function () {
    it('should return user staking and rental info', async function () {
      const stakeAmount = ethers.parseEther('1000');
      await nativeToken.connect(user1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(user1).stake(stakeAmount, 50000);

      await registry.connect(user2).registerModule(ethers.parseEther('0.01'), 10, 'QmTest');
      const cost = ethers.parseEther('0.01') * 1000n;
      await nativeToken.connect(user1).approve(await marketplace.getAddress(), cost);
      await marketplace.connect(user1).rent(1, 1000);

      const [stakedAmount, blocTimeBalance, pendingRewards, activeRentals] = 
        await integration.getUserInfo(user1.address);
      
      expect(stakedAmount).to.equal(stakeAmount);
      expect(blocTimeBalance).to.equal(stakeAmount * 2n);
      expect(activeRentals.length).to.equal(1);
    });
  });

  describe('Module Info', function () {
    it('should return module details', async function () {
      await registry.connect(user2).registerModule(ethers.parseEther('0.01'), 10, 'QmTest');

      const [owner, pricePerBlock, maxUsers, currentUsers, active, ipfsHash] = 
        await integration.getModuleInfo(1);
      
      expect(owner).to.equal(user2.address);
      expect(pricePerBlock).to.equal(ethers.parseEther('0.01'));
      expect(maxUsers).to.equal(10);
      expect(currentUsers).to.equal(0);
      expect(active).to.be.true;
      expect(ipfsHash).to.equal('QmTest');
    });
  });
});
