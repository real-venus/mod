const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('GoldFi', function () {
  let goldfi, rewardToken;
  let owner, oracle, alice, bob, charlie;
  const EPOCH_DURATION = 7 * 24 * 60 * 60; // 7 days
  const PLATFORM_FEE_BPS = 100; // 1%
  const INFLATION_POOL = ethers.parseUnits('1000', 6); // 1000 USDC (6 decimals)

  beforeEach(async function () {
    [owner, oracle, alice, bob, charlie] = await ethers.getSigners();

    // Deploy mock USDC
    const MockToken = await ethers.getContractFactory('MockERC20');
    rewardToken = await MockToken.deploy('USD Coin', 'USDC', 6);
    await rewardToken.waitForDeployment();

    // Mint tokens to owner for inflation pool
    await rewardToken.mint(owner.address, ethers.parseUnits('100000', 6));

    // Deploy GoldFi
    const GoldFi = await ethers.getContractFactory('GoldFi');
    goldfi = await GoldFi.deploy(
      await rewardToken.getAddress(),
      oracle.address,
      EPOCH_DURATION,
      PLATFORM_FEE_BPS
    );
    await goldfi.waitForDeployment();

    // Approve GoldFi to spend owner's tokens (for inflation pool deposits)
    await rewardToken.approve(await goldfi.getAddress(), ethers.MaxUint256);
  });

  describe('Asset Management', function () {
    it('should add assets', async function () {
      const PAXG = '0x45804880De22913dAFE09f4980848ECE6EcbAf78';
      const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

      await goldfi.addAsset('PAXG', PAXG, USDC);
      const asset = await goldfi.assets(1);
      expect(asset.symbol).to.equal('PAXG');
      expect(asset.active).to.be.true;
    });

    it('should toggle assets', async function () {
      await goldfi.addAsset('PAXG', alice.address, bob.address);
      await goldfi.toggleAsset(1, false);
      const asset = await goldfi.assets(1);
      expect(asset.active).to.be.false;
    });

    it('should reject duplicate assets', async function () {
      await goldfi.addAsset('PAXG', alice.address, bob.address);
      await expect(goldfi.addAsset('PAXG', alice.address, bob.address))
        .to.be.revertedWith('Asset exists');
    });
  });

  describe('Trader Registration', function () {
    it('should register traders', async function () {
      await goldfi.connect(alice).register();
      expect(await goldfi.registeredTraders(alice.address)).to.be.true;
    });

    it('should reject duplicate registration', async function () {
      await goldfi.connect(alice).register();
      await expect(goldfi.connect(alice).register())
        .to.be.revertedWith('Already registered');
    });

    it('should unregister traders', async function () {
      await goldfi.connect(alice).register();
      await goldfi.connect(alice).unregister();
      expect(await goldfi.registeredTraders(alice.address)).to.be.false;
    });
  });

  describe('Epoch Lifecycle', function () {
    beforeEach(async function () {
      await goldfi.connect(alice).register();
      await goldfi.connect(bob).register();
      await goldfi.connect(charlie).register();
    });

    it('should start an epoch with inflation pool', async function () {
      await goldfi.startEpoch(INFLATION_POOL);
      const epoch = await goldfi.getCurrentEpoch();
      expect(epoch.epochId).to.equal(1);
      expect(epoch.inflationPool).to.equal(INFLATION_POOL);
      expect(epoch.traderCount).to.equal(3);
    });

    it('should not start epoch if previous not settled', async function () {
      await goldfi.startEpoch(INFLATION_POOL);
      await expect(goldfi.startEpoch(INFLATION_POOL))
        .to.be.revertedWith('Previous epoch not settled');
    });

    it('should report PnL via oracle', async function () {
      await goldfi.startEpoch(INFLATION_POOL);
      // Alice: +20%, Bob: -5%, Charlie: +8%
      await goldfi.connect(oracle).reportPnl(1, alice.address, 2000);
      await goldfi.connect(oracle).reportPnl(1, bob.address, -500);
      await goldfi.connect(oracle).reportPnl(1, charlie.address, 800);

      const aliceInfo = await goldfi.getTraderInfo(1, alice.address);
      expect(aliceInfo.pnlBps).to.equal(2000);
    });

    it('should batch report PnL', async function () {
      await goldfi.startEpoch(INFLATION_POOL);
      await goldfi.connect(oracle).reportPnlBatch(
        1,
        [alice.address, bob.address, charlie.address],
        [2000, -500, 800]
      );

      const bobInfo = await goldfi.getTraderInfo(1, bob.address);
      expect(bobInfo.pnlBps).to.equal(-500);
    });

    it('should reject PnL from non-oracle', async function () {
      await goldfi.startEpoch(INFLATION_POOL);
      await expect(goldfi.connect(alice).reportPnl(1, alice.address, 2000))
        .to.be.revertedWith('Not oracle');
    });
  });

  describe('Quadratic Settlement & Rewards', function () {
    beforeEach(async function () {
      await goldfi.connect(alice).register();
      await goldfi.connect(bob).register();
      await goldfi.connect(charlie).register();
      await goldfi.startEpoch(INFLATION_POOL);

      // Alice: +20% (2000 bps), Bob: -5% (-500 bps), Charlie: +8% (800 bps)
      await goldfi.connect(oracle).reportPnlBatch(
        1,
        [alice.address, bob.address, charlie.address],
        [2000, -500, 800]
      );
    });

    it('should not settle before epoch ends', async function () {
      await expect(goldfi.connect(oracle).settleEpoch(1))
        .to.be.revertedWith('Epoch not ended');
    });

    it('should settle with quadratic scores', async function () {
      await time.increase(EPOCH_DURATION);
      await goldfi.connect(oracle).settleEpoch(1);

      // Alice: 2000^2 = 4,000,000
      // Bob: -(500^2) = -250,000 → 0 reward
      // Charlie: 800^2 = 640,000
      // Total positive: 4,640,000
      const aliceInfo = await goldfi.getTraderInfo(1, alice.address);
      const bobInfo = await goldfi.getTraderInfo(1, bob.address);
      const charlieInfo = await goldfi.getTraderInfo(1, charlie.address);

      expect(aliceInfo.score).to.equal(BigInt(2000) * BigInt(2000));
      expect(bobInfo.score).to.equal(-(BigInt(500) * BigInt(500)));
      expect(charlieInfo.score).to.equal(BigInt(800) * BigInt(800));

      // Bob gets nothing
      expect(bobInfo.reward).to.equal(0);

      // Alice and Charlie split the pool (minus 1% fee)
      // Pool after fee: 1000 * 0.99 = 990 USDC
      const poolAfterFee = INFLATION_POOL - (INFLATION_POOL * BigInt(PLATFORM_FEE_BPS)) / BigInt(10000);
      const totalPositive = BigInt(4000000) + BigInt(640000);

      const expectedAlice = (poolAfterFee * BigInt(4000000)) / totalPositive;
      const expectedCharlie = (poolAfterFee * BigInt(640000)) / totalPositive;

      expect(aliceInfo.reward).to.equal(expectedAlice);
      expect(charlieInfo.reward).to.equal(expectedCharlie);
    });

    it('should allow claiming rewards after settlement', async function () {
      await time.increase(EPOCH_DURATION);
      await goldfi.connect(oracle).settleEpoch(1);

      const aliceInfo = await goldfi.getTraderInfo(1, alice.address);
      const balanceBefore = await rewardToken.balanceOf(alice.address);

      await goldfi.connect(alice).claimReward(1);

      const balanceAfter = await rewardToken.balanceOf(alice.address);
      expect(balanceAfter - balanceBefore).to.equal(aliceInfo.reward);
    });

    it('should reject double claim', async function () {
      await time.increase(EPOCH_DURATION);
      await goldfi.connect(oracle).settleEpoch(1);
      await goldfi.connect(alice).claimReward(1);
      await expect(goldfi.connect(alice).claimReward(1))
        .to.be.revertedWith('Already claimed');
    });

    it('should reject claim with no reward (Bob)', async function () {
      await time.increase(EPOCH_DURATION);
      await goldfi.connect(oracle).settleEpoch(1);
      await expect(goldfi.connect(bob).claimReward(1))
        .to.be.revertedWith('No reward');
    });

    it('should return correct leaderboard', async function () {
      await time.increase(EPOCH_DURATION);
      await goldfi.connect(oracle).settleEpoch(1);

      const [addrs, scores, rewards] = await goldfi.getLeaderboard(1);
      expect(addrs.length).to.equal(3);
      // All three should have scores
      expect(scores[0]).to.equal(BigInt(2000 * 2000)); // Alice
      expect(scores[1]).to.equal(BigInt(-500 * 500));   // Bob (negative)
      expect(scores[2]).to.equal(BigInt(800 * 800));    // Charlie
    });
  });

  describe('Multi-Epoch', function () {
    it('should run consecutive epochs', async function () {
      await goldfi.connect(alice).register();
      await goldfi.connect(bob).register();

      // Epoch 1
      await goldfi.startEpoch(INFLATION_POOL);
      await goldfi.connect(oracle).reportPnlBatch(1, [alice.address, bob.address], [1000, -200]);
      await time.increase(EPOCH_DURATION);
      await goldfi.connect(oracle).settleEpoch(1);

      // Epoch 2
      await goldfi.startEpoch(INFLATION_POOL);
      const epoch = await goldfi.getCurrentEpoch();
      expect(epoch.epochId).to.equal(2);
      expect(epoch.traderCount).to.equal(2);
    });
  });

  describe('Admin', function () {
    it('should update oracle', async function () {
      await goldfi.setOracle(alice.address);
      expect(await goldfi.oracle()).to.equal(alice.address);
    });

    it('should withdraw fees', async function () {
      await goldfi.connect(alice).register();
      await goldfi.startEpoch(INFLATION_POOL);
      await goldfi.connect(oracle).reportPnl(1, alice.address, 1000);
      await time.increase(EPOCH_DURATION);
      await goldfi.connect(oracle).settleEpoch(1);

      const expectedFee = INFLATION_POOL * BigInt(PLATFORM_FEE_BPS) / BigInt(10000);
      const balBefore = await rewardToken.balanceOf(owner.address);
      await goldfi.withdrawFees();
      const balAfter = await rewardToken.balanceOf(owner.address);
      expect(balAfter - balBefore).to.equal(expectedFee);
    });

    it('should reject high platform fee', async function () {
      await expect(goldfi.setPlatformFee(600))
        .to.be.revertedWith('Fee too high');
    });
  });
});
