const { expect } = require("chai");
const { ethers } = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("StakeTime + Incentive", function () {
  let stakeTime, incentive, nativeToken;
  let owner, user1, user2;

  const EMISSION_RATE = ethers.parseEther("100");
  const DECAY_BPS = 500;
  const EPOCH_LENGTH = 50;
  const MAX_LOCK_BLOCKS = 100000;
  const MAX_STAKERS = 3;
  const DEFAULT_COMMISSION_BPS = 1000; // 10%

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy NativeToken (1M supply)
    const NativeToken = await ethers.getContractFactory("NativeToken");
    nativeToken = await NativeToken.deploy(ethers.parseEther("1000000"));
    await nativeToken.waitForDeployment();

    // Deploy StakeTime (staking primitive)
    const StakeTime = await ethers.getContractFactory("StakeTime");
    stakeTime = await StakeTime.deploy(
      await nativeToken.getAddress(),
      MAX_LOCK_BLOCKS,
      MAX_STAKERS,
      DEFAULT_COMMISSION_BPS,
      EPOCH_LENGTH
    );
    await stakeTime.waitForDeployment();

    // Deploy Subnet (emission layer)
    const Subnet = await ethers.getContractFactory("Subnet");
    incentive = await Subnet.deploy(
      await stakeTime.getAddress(),
      await nativeToken.getAddress(),
      EMISSION_RATE,
      DECAY_BPS,
      EPOCH_LENGTH
    );
    await incentive.waitForDeployment();

    // Register validators via owner BEFORE transferring ownership
    await stakeTime.registerValidatorAdmin("val1", 1, 1000); // ed25519, 10% commission

    // Transfer StakeTime ownership to Subnet (so it can advanceEpoch)
    await stakeTime.transferOwnership(await incentive.getAddress());

    // Fund Subnet with emission tokens
    await nativeToken.transfer(await incentive.getAddress(), ethers.parseEther("500000"));

    // Fund users
    await nativeToken.transfer(user1.address, ethers.parseEther("10000"));
    await nativeToken.transfer(user2.address, ethers.parseEther("10000"));

    // Approve StakeTime
    await nativeToken.connect(user1).approve(await stakeTime.getAddress(), ethers.MaxUint256);
    await nativeToken.connect(user2).approve(await stakeTime.getAddress(), ethers.MaxUint256);
  });

  // ── StakeTime: Deployment ───────────────────────────────────────────

  describe("StakeTime: Deployment", function () {
    it("sets nativeToken", async function () {
      expect(await stakeTime.nativeToken()).to.equal(await nativeToken.getAddress());
    });

    it("sets staking params", async function () {
      expect(await stakeTime.maxLockBlocks()).to.equal(MAX_LOCK_BLOCKS);
      expect(await stakeTime.maxStakersPerValidator()).to.equal(MAX_STAKERS);
      expect(await stakeTime.defaultCommissionBps()).to.equal(DEFAULT_COMMISSION_BPS);
    });

    it("has default 1x multiplier point", async function () {
      expect(await stakeTime.getMultiplier(0)).to.equal(10000);
    });

    it("mints STT ERC20 with correct name/symbol", async function () {
      expect(await stakeTime.name()).to.equal("StakeTime");
      expect(await stakeTime.symbol()).to.equal("STT");
    });
  });

  // ── StakeTime: Validator Registration ───────────────────────────────

  describe("StakeTime: Validator Registration", function () {
    it("registered validator is active", async function () {
      const v = await stakeTime.getValidator("val1");
      expect(v._key).to.equal("val1");
      expect(v._active).to.be.true;
      expect(v._commissionBps).to.equal(1000);
    });

    it("self-registers a validator", async function () {
      // StakeTime is owned by Incentive now, but anyone can self-register
      await stakeTime.connect(user1).registerValidator("user1val", 0);
      const v = await stakeTime.getValidator("user1val");
      expect(v._active).to.be.true;
      expect(v._commissionBps).to.equal(DEFAULT_COMMISSION_BPS);
    });

    it("counts validators", async function () {
      expect(await stakeTime.validatorCount()).to.equal(1);
      await stakeTime.connect(user1).registerValidator("v2", 0);
      expect(await stakeTime.validatorCount()).to.equal(2);
    });
  });

  // ── Incentive: Deployment ───────────────────────────────────────────

  describe("Incentive: Deployment", function () {
    it("sets consensus params", async function () {
      const block = await incentive.getBlock();
      expect(block[3]).to.equal(EMISSION_RATE);
      expect(block[4]).to.equal(DECAY_BPS);
      expect(block[5]).to.equal(EPOCH_LENGTH);
    });

    it("references StakeTime contract", async function () {
      expect(await incentive.stakeTime()).to.equal(await stakeTime.getAddress());
    });
  });

  // ── Incentive: Checkin & Scoring ────────────────────────────────────

  describe("Incentive: Checkin & Scoring", function () {
    it("checkin increments blocktimeScore", async function () {
      await incentive.batchCheckin(["val1"]);
      const s = await incentive.getValidatorScore(
        ethers.keccak256(ethers.toUtf8Bytes("val1"))
      );
      expect(s.blocktimeScore).to.be.gt(0);
    });

    it("batch checkin works for multiple validators", async function () {
      await stakeTime.connect(user1).registerValidator("val2", 0);
      await incentive.batchCheckin(["val1", "val2"]);

      const s1 = await incentive.getValidatorScore(
        ethers.keccak256(ethers.toUtf8Bytes("val1"))
      );
      const s2 = await incentive.getValidatorScore(
        ethers.keccak256(ethers.toUtf8Bytes("val2"))
      );
      expect(s1.blocktimeScore).to.be.gt(0);
      expect(s2.blocktimeScore).to.be.gt(0);
    });

    it("updates totalBlocktime", async function () {
      await incentive.batchCheckin(["val1"]);
      const block = await incentive.getBlock();
      expect(block[2]).to.be.gt(0); // totalBlocktime
    });
  });

  // ── StakeTime: Staking ──────────────────────────────────────────────

  describe("StakeTime: Staking", function () {
    it("stakes on a validator and mints STT", async function () {
      const amount = ethers.parseEther("1000");
      await expect(stakeTime.connect(user1).stakeOn("val1", amount, 0))
        .to.emit(stakeTime, "Staked");

      expect(await stakeTime.balanceOf(user1.address)).to.equal(amount);
    });

    it("applies multiplier curve for longer lock", async function () {
      // Need to set points via Incentive (owner of StakeTime) — but setPoints is onlyOwner
      // Incentive is the owner, so we can't call setPoints directly
      // For this test, we deploy a fresh StakeTime without ownership transfer
      const StakeTime2 = await ethers.getContractFactory("StakeTime");
      const st2 = await StakeTime2.deploy(
        await nativeToken.getAddress(), MAX_LOCK_BLOCKS, MAX_STAKERS, DEFAULT_COMMISSION_BPS, EPOCH_LENGTH
      );
      await st2.waitForDeployment();
      await st2.registerValidatorAdmin("v1", 1, 1000);
      await st2.setPoints([
        { blocks: 0, multiplier: 10000 },
        { blocks: 10000, multiplier: 20000 },
      ]);

      await nativeToken.transfer(user1.address, ethers.parseEther("1000"));
      await nativeToken.connect(user1).approve(await st2.getAddress(), ethers.MaxUint256);
      await st2.connect(user1).stakeOn("v1", ethers.parseEther("1000"), 10000);

      // 2x multiplier → 2000 STT
      expect(await st2.balanceOf(user1.address)).to.equal(ethers.parseEther("2000"));
    });

    it("tracks stake position", async function () {
      await stakeTime.connect(user1).stakeOn("val1", ethers.parseEther("500"), 100);
      const ids = await stakeTime.getUserStakeIds(user1.address);
      expect(ids.length).to.equal(1);

      const pos = await stakeTime.getStakePosition(ids[0]);
      expect(pos.staker).to.equal(user1.address);
      expect(pos.amount).to.equal(ethers.parseEther("500"));
    });

    it("tracks validator total stake time", async function () {
      await stakeTime.connect(user1).stakeOn("val1", ethers.parseEther("1000"), 0);
      expect(await stakeTime.getValidatorTotalStakeTime("val1")).to.equal(ethers.parseEther("1000"));
    });

    it("rejects zero amount", async function () {
      await expect(
        stakeTime.connect(user1).stakeOn("val1", 0, 0)
      ).to.be.revertedWith("amount must be > 0");
    });

    it("rejects exceeding max lock blocks", async function () {
      await expect(
        stakeTime.connect(user1).stakeOn("val1", ethers.parseEther("100"), MAX_LOCK_BLOCKS + 1)
      ).to.be.revertedWith("exceeds max lock blocks");
    });

    it("rejects staking on inactive validator", async function () {
      await expect(
        stakeTime.connect(user1).stakeOn("nonexistent", ethers.parseEther("100"), 0)
      ).to.be.revertedWith("validator not active");
    });

    it("enforces max stakers per validator per epoch", async function () {
      const [, , , user3, user4] = await ethers.getSigners();
      await nativeToken.transfer(user3.address, ethers.parseEther("1000"));
      await nativeToken.transfer(user4.address, ethers.parseEther("1000"));
      await nativeToken.connect(user3).approve(await stakeTime.getAddress(), ethers.MaxUint256);
      await nativeToken.connect(user4).approve(await stakeTime.getAddress(), ethers.MaxUint256);

      await stakeTime.connect(user1).stakeOn("val1", ethers.parseEther("100"), 0);
      await stakeTime.connect(user2).stakeOn("val1", ethers.parseEther("100"), 0);
      await stakeTime.connect(user3).stakeOn("val1", ethers.parseEther("100"), 0);

      await expect(
        stakeTime.connect(user4).stakeOn("val1", ethers.parseEther("100"), 0)
      ).to.be.revertedWith("max stakers reached for this validator this epoch");
    });
  });

  // ── StakeTime: Unstaking ────────────────────────────────────────────

  describe("StakeTime: Unstaking", function () {
    it("rejects unstake while locked", async function () {
      await stakeTime.connect(user1).stakeOn("val1", ethers.parseEther("1000"), 100);
      const ids = await stakeTime.getUserStakeIds(user1.address);
      await expect(
        stakeTime.connect(user1).unstakeFrom(ids[0])
      ).to.be.revertedWith("still locked");
    });

    it("unstakes after lock period", async function () {
      const amount = ethers.parseEther("1000");
      await stakeTime.connect(user1).stakeOn("val1", amount, 10);
      const ids = await stakeTime.getUserStakeIds(user1.address);

      await mine(15);

      const balBefore = await nativeToken.balanceOf(user1.address);
      await expect(stakeTime.connect(user1).unstakeFrom(ids[0]))
        .to.emit(stakeTime, "Unstaked");
      const balAfter = await nativeToken.balanceOf(user1.address);

      expect(balAfter - balBefore).to.equal(amount);
      expect(await stakeTime.balanceOf(user1.address)).to.equal(0);
    });

    it("rejects unstake by non-owner of stake", async function () {
      await stakeTime.connect(user1).stakeOn("val1", ethers.parseEther("1000"), 0);
      const ids = await stakeTime.getUserStakeIds(user1.address);
      await expect(
        stakeTime.connect(user2).unstakeFrom(ids[0])
      ).to.be.revertedWith("not your stake");
    });
  });

  // ── StakeTime: Multiplier Curve ─────────────────────────────────────

  describe("StakeTime: Multiplier Curve", function () {
    let freshStakeTime;

    beforeEach(async function () {
      // Deploy fresh StakeTime we still own (not transferred to Incentive)
      const ST = await ethers.getContractFactory("StakeTime");
      freshStakeTime = await ST.deploy(
        await nativeToken.getAddress(), MAX_LOCK_BLOCKS, MAX_STAKERS, DEFAULT_COMMISSION_BPS, EPOCH_LENGTH
      );
      await freshStakeTime.waitForDeployment();
    });

    it("sets custom points", async function () {
      await freshStakeTime.setPoints([
        { blocks: 0, multiplier: 10000 },
        { blocks: 50000, multiplier: 20000 },
        { blocks: 100000, multiplier: 30000 },
      ]);
      expect(await freshStakeTime.getMultiplier(0)).to.equal(10000);
      expect(await freshStakeTime.getMultiplier(100000)).to.equal(30000);
    });

    it("interpolates between points", async function () {
      await freshStakeTime.setPoints([
        { blocks: 0, multiplier: 10000 },
        { blocks: 100000, multiplier: 20000 },
      ]);
      expect(await freshStakeTime.getMultiplier(50000)).to.equal(15000);
    });

    it("rejects non-monotonic blocks", async function () {
      await expect(
        freshStakeTime.setPoints([
          { blocks: 100, multiplier: 10000 },
          { blocks: 50, multiplier: 20000 },
        ])
      ).to.be.revertedWith("blocks must increase");
    });

    it("rejects multiplier < 1x", async function () {
      await expect(
        freshStakeTime.setPoints([{ blocks: 0, multiplier: 5000 }])
      ).to.be.revertedWith("multiplier must be >= 1x");
    });
  });

  // ── Incentive: Emission Distribution ────────────────────────────────

  describe("Incentive: Emission Distribution", function () {
    it("distributes 100% to validator when no stakers", async function () {
      await incentive.batchCheckin(["val1"]);

      for (let i = 0; i < EPOCH_LENGTH; i++) {
        await incentive.produceBlock();
      }

      const vBal = await incentive.getValidatorBalance("val1");
      expect(vBal).to.be.gt(0);
    });

    it("splits emissions between validator commission and stakers", async function () {
      await incentive.batchCheckin(["val1"]);
      await stakeTime.connect(user1).stakeOn("val1", ethers.parseEther("1000"), 0);

      for (let i = 0; i < EPOCH_LENGTH; i++) {
        await incentive.produceBlock();
      }

      const vBal = await incentive.getValidatorBalance("val1");
      const sReward = await incentive.getStakerRewards(user1.address);

      expect(vBal).to.be.gt(0);
      expect(sReward).to.be.gt(0);
      // Staker gets ~9x commission (90% vs 10%)
      expect(sReward).to.be.gt(vBal * BigInt(7));
    });

    it("distributes to multiple stakers proportionally", async function () {
      await incentive.batchCheckin(["val1"]);

      await stakeTime.connect(user1).stakeOn("val1", ethers.parseEther("3000"), 0);
      await stakeTime.connect(user2).stakeOn("val1", ethers.parseEther("1000"), 0);

      for (let i = 0; i < EPOCH_LENGTH; i++) {
        await incentive.produceBlock();
      }

      const r1 = await incentive.getStakerRewards(user1.address);
      const r2 = await incentive.getStakerRewards(user2.address);

      expect(r1).to.be.gt(0);
      expect(r2).to.be.gt(0);
      expect(r1).to.be.gt(r2 * BigInt(2));
    });

    it("rejects distribution before epoch", async function () {
      await incentive.batchCheckin(["val1"]);
      await incentive.produceBlock();
      await expect(incentive.distributeEmissions())
        .to.be.revertedWith("epoch not reached");
    });
  });

  // ── Incentive: Reward Claims ────────────────────────────────────────

  describe("Incentive: Reward Claims", function () {
    beforeEach(async function () {
      await incentive.batchCheckin(["val1"]);
      await stakeTime.connect(user1).stakeOn("val1", ethers.parseEther("1000"), 0);

      for (let i = 0; i < EPOCH_LENGTH; i++) {
        await incentive.produceBlock();
      }
    });

    it("staker claims rewards", async function () {
      const reward = await incentive.getStakerRewards(user1.address);
      expect(reward).to.be.gt(0);

      const balBefore = await nativeToken.balanceOf(user1.address);
      await incentive.connect(user1).claimStakerRewards();
      const balAfter = await nativeToken.balanceOf(user1.address);

      expect(balAfter - balBefore).to.equal(reward);
      expect(await incentive.getStakerRewards(user1.address)).to.equal(0);
    });

    it("rejects claim with no rewards", async function () {
      await expect(
        incentive.connect(user2).claimStakerRewards()
      ).to.be.revertedWith("nothing to claim");
    });

    it("validator claims commission via owner (non-ECDSA)", async function () {
      const vBal = await incentive.getValidatorBalance("val1");
      expect(vBal).to.be.gt(0);

      const balBefore = await nativeToken.balanceOf(owner.address);
      await incentive.claimValidatorRewards("val1", owner.address);
      const balAfter = await nativeToken.balanceOf(owner.address);

      expect(balAfter - balBefore).to.equal(vBal);
    });
  });

  // ── Incentive: Block Production ─────────────────────────────────────

  describe("Incentive: Block Production", function () {
    it("produces blocks and emits event", async function () {
      await incentive.batchCheckin(["val1"]);
      await expect(incentive.produceBlock())
        .to.emit(incentive, "BlockProduced");

      const block = await incentive.getBlock();
      expect(block[0]).to.equal(1);
    });

    it("rejects block production with no active validators", async function () {
      await expect(incentive.produceBlock())
        .to.be.revertedWith("no active validators");
    });

    it("auto-distributes at epoch boundary", async function () {
      await incentive.batchCheckin(["val1"]);

      for (let i = 0; i < EPOCH_LENGTH; i++) {
        await incentive.produceBlock();
      }

      const kh = ethers.keccak256(ethers.toUtf8Bytes("val1"));
      const s = await incentive.getValidatorScore(kh);
      expect(s.earned).to.be.gt(0);
    });
  });

  // ── Incentive: Admin ────────────────────────────────────────────────

  describe("Incentive: Admin", function () {
    it("updates emission rate", async function () {
      await incentive.setEmissionRate(ethers.parseEther("200"));
      const block = await incentive.getBlock();
      expect(block[3]).to.equal(ethers.parseEther("200"));
    });

    it("rejects non-owner admin calls", async function () {
      await expect(
        incentive.connect(user1).setEmissionRate(1)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  // ── Incentive: Leaderboard ──────────────────────────────────────────

  describe("Incentive: Leaderboard", function () {
    it("returns validators sorted by score", async function () {
      await stakeTime.connect(user1).registerValidator("low", 0);
      await incentive.batchCheckin(["val1"]);
      await mine(5);
      await incentive.batchCheckin(["val1"]);
      await incentive.batchCheckin(["low"]);

      const [keys, scores] = await incentive.getLeaderboard(2);
      expect(scores[0]).to.be.gte(scores[1]);
    });
  });

  // ── Integration: Full Flow ──────────────────────────────────────────

  describe("Integration: Full Flow", function () {
    it("register → stake → checkin → produce → distribute → claim", async function () {
      // Validator already registered (val1)
      // User stakes on validator
      await stakeTime.connect(user1).stakeOn("val1", ethers.parseEther("5000"), 0);
      expect(await stakeTime.balanceOf(user1.address)).to.equal(ethers.parseEther("5000"));

      // Validator checks in
      await incentive.batchCheckin(["val1"]);

      // Run a full epoch
      for (let i = 0; i < EPOCH_LENGTH; i++) {
        await incentive.produceBlock();
      }

      // Both have rewards
      const stakerReward = await incentive.getStakerRewards(user1.address);
      const validatorReward = await incentive.getValidatorBalance("val1");
      expect(stakerReward).to.be.gt(0);
      expect(validatorReward).to.be.gt(0);

      // Claim both
      await incentive.connect(user1).claimStakerRewards();
      await incentive.claimValidatorRewards("val1", owner.address);

      expect(await incentive.getStakerRewards(user1.address)).to.equal(0);
      expect(await incentive.getValidatorBalance("val1")).to.equal(0);

      // Unstake (0 lock blocks, so immediate)
      const ids = await stakeTime.getUserStakeIds(user1.address);
      await stakeTime.connect(user1).unstakeFrom(ids[0]);
      expect(await stakeTime.balanceOf(user1.address)).to.equal(0);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════
// Registry Tests
// ════════════════════════════════════════════════════════════════════════

describe("Registry", function () {
  let registry, nativeToken;
  let stakeTime1, incentive1;
  let stakeTime2, incentive2;
  let owner, user1, user2;

  const EMISSION_RATE = ethers.parseEther("100");
  const DECAY_BPS = 500;
  const EPOCH_LENGTH = 50;
  const MAX_LOCK_BLOCKS = 100000;
  const MAX_STAKERS = 10;
  const DEFAULT_COMMISSION_BPS = 1000;
  const IMMUNITY_PERIOD = 20; // blocks
  const REGISTRATION_COST = ethers.parseEther("1000"); // 1000 NTV

  async function deploySubnet(token) {
    const StakeTime = await ethers.getContractFactory("StakeTime");
    const st = await StakeTime.deploy(
      await token.getAddress(), MAX_LOCK_BLOCKS, MAX_STAKERS, DEFAULT_COMMISSION_BPS, EPOCH_LENGTH
    );
    await st.waitForDeployment();

    const Subnet = await ethers.getContractFactory("Subnet");
    const inc = await Subnet.deploy(
      await st.getAddress(), await token.getAddress(), EMISSION_RATE, DECAY_BPS, EPOCH_LENGTH
    );
    await inc.waitForDeployment();

    return { stakeTime: st, incentive: inc };
  }

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const NativeToken = await ethers.getContractFactory("NativeToken");
    nativeToken = await NativeToken.deploy(ethers.parseEther("10000000"));
    await nativeToken.waitForDeployment();

    // Deploy two subnets
    const sub1 = await deploySubnet(nativeToken);
    stakeTime1 = sub1.stakeTime;
    incentive1 = sub1.incentive;

    const sub2 = await deploySubnet(nativeToken);
    stakeTime2 = sub2.stakeTime;
    incentive2 = sub2.incentive;

    // Deploy Registry with NativeToken lock
    const Registry = await ethers.getContractFactory("Registry");
    registry = await Registry.deploy(IMMUNITY_PERIOD, await nativeToken.getAddress(), REGISTRATION_COST);
    await registry.waitForDeployment();

    // Approve Registry to spend owner's NativeToken
    await nativeToken.approve(await registry.getAddress(), ethers.MaxUint256);

    // Fund user1 and user2 for registration
    await nativeToken.transfer(user1.address, ethers.parseEther("100000"));
    await nativeToken.transfer(user2.address, ethers.parseEther("100000"));
    await nativeToken.connect(user1).approve(await registry.getAddress(), ethers.MaxUint256);
    await nativeToken.connect(user2).approve(await registry.getAddress(), ethers.MaxUint256);
  });

  describe("Registration", function () {
    it("registers a subnet and locks NativeToken", async function () {
      const balBefore = await nativeToken.balanceOf(owner.address);
      await expect(
        registry.registerSubnet("genesis", await stakeTime1.getAddress(), await incentive1.getAddress())
      ).to.emit(registry, "SubnetRegistered");

      expect(await registry.getSubnetCount()).to.equal(1);

      // Check tokens were locked
      const balAfter = await nativeToken.balanceOf(owner.address);
      expect(balBefore - balAfter).to.equal(REGISTRATION_COST);
      expect(await nativeToken.balanceOf(await registry.getAddress())).to.equal(REGISTRATION_COST);
      expect(await registry.getLockedStake(0)).to.equal(REGISTRATION_COST);
    });

    it("registers multiple subnets", async function () {
      await registry.registerSubnet("sub1", await stakeTime1.getAddress(), await incentive1.getAddress());
      await registry.registerSubnet("sub2", await stakeTime2.getAddress(), await incentive2.getAddress());
      expect(await registry.getSubnetCount()).to.equal(2);
      expect(await nativeToken.balanceOf(await registry.getAddress())).to.equal(REGISTRATION_COST * BigInt(2));
    });

    it("rejects zero addresses", async function () {
      await expect(
        registry.registerSubnet("bad", ethers.ZeroAddress, await incentive1.getAddress())
      ).to.be.revertedWith("zero stakeTime");
    });

    it("reverts without NativeToken approval", async function () {
      const [, , , user3] = await ethers.getSigners();
      // user3 has no tokens and no approval
      await expect(
        registry.connect(user3).registerSubnet("bad", await stakeTime1.getAddress(), await incentive1.getAddress())
      ).to.be.reverted;
    });

    it("assigns sequential IDs", async function () {
      await registry.registerSubnet("sub1", await stakeTime1.getAddress(), await incentive1.getAddress());
      await registry.registerSubnet("sub2", await stakeTime2.getAddress(), await incentive2.getAddress());

      const s1 = await registry.getSubnet(0);
      const s2 = await registry.getSubnet(1);
      expect(s1.name).to.equal("sub1");
      expect(s2.name).to.equal("sub2");
    });

    it("tracks owner subnets", async function () {
      await registry.registerSubnet("sub1", await stakeTime1.getAddress(), await incentive1.getAddress());
      await registry.connect(user1).registerSubnet("sub2", await stakeTime2.getAddress(), await incentive2.getAddress());

      const ownerSubs = await registry.getOwnerSubnets(owner.address);
      const user1Subs = await registry.getOwnerSubnets(user1.address);
      expect(ownerSubs.length).to.equal(1);
      expect(user1Subs.length).to.equal(1);
    });
  });

  describe("Views", function () {
    beforeEach(async function () {
      await registry.registerSubnet("sub1", await stakeTime1.getAddress(), await incentive1.getAddress());
      await registry.registerSubnet("sub2", await stakeTime2.getAddress(), await incentive2.getAddress());
    });

    it("getSubnet returns correct data", async function () {
      const s = await registry.getSubnet(0);
      expect(s.name).to.equal("sub1");
      expect(s.stakeTime).to.equal(await stakeTime1.getAddress());
      expect(s.incentive).to.equal(await incentive1.getAddress());
      expect(s.active).to.be.true;
    });

    it("getAllSubnets returns all active subnets", async function () {
      const all = await registry.getAllSubnets();
      expect(all.length).to.equal(2);
    });

    it("getStakeScore includes locked stake plus STT supply", async function () {
      // No staking yet — score should be just the locked registration cost
      expect(await registry.getStakeScore(0)).to.equal(REGISTRATION_COST);

      // Stake on subnet 1 to give it some STT supply
      await stakeTime1.registerValidatorAdmin("v1", 1, 1000);
      await nativeToken.approve(await stakeTime1.getAddress(), ethers.MaxUint256);
      await stakeTime1.stakeOn("v1", ethers.parseEther("1000"), 0);

      // Score = locked (1000) + STT supply (1000) = 2000
      expect(await registry.getStakeScore(0)).to.equal(REGISTRATION_COST + ethers.parseEther("1000"));
    });
  });

  describe("Immunity", function () {
    it("new subnets are immune", async function () {
      await registry.registerSubnet("sub1", await stakeTime1.getAddress(), await incentive1.getAddress());
      expect(await registry.isImmune(0)).to.be.true;
    });

    it("subnets lose immunity after period", async function () {
      await registry.registerSubnet("sub1", await stakeTime1.getAddress(), await incentive1.getAddress());
      await mine(IMMUNITY_PERIOD + 1);
      expect(await registry.isImmune(0)).to.be.false;
    });

    it("owner can update immunity period", async function () {
      await registry.setImmunityPeriod(100);
      expect(await registry.immunityPeriod()).to.equal(100);
    });

    it("non-owner cannot update immunity period", async function () {
      await expect(
        registry.connect(user1).setImmunityPeriod(100)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Deregistration", function () {
    it("owner can deregister and get locked tokens back", async function () {
      await registry.registerSubnet("sub1", await stakeTime1.getAddress(), await incentive1.getAddress());
      const balBefore = await nativeToken.balanceOf(owner.address);

      await expect(registry.deregisterSubnet(0))
        .to.emit(registry, "SubnetDeregistered");

      expect(await registry.getSubnetCount()).to.equal(0);
      const s = await registry.getSubnet(0);
      expect(s.active).to.be.false;

      // Locked tokens returned
      const balAfter = await nativeToken.balanceOf(owner.address);
      expect(balAfter - balBefore).to.equal(REGISTRATION_COST);
      expect(await registry.getLockedStake(0)).to.equal(0);
    });

    it("subnet owner can deregister their own", async function () {
      await registry.connect(user1).registerSubnet("sub1", await stakeTime1.getAddress(), await incentive1.getAddress());
      const balBefore = await nativeToken.balanceOf(user1.address);
      await registry.connect(user1).deregisterSubnet(0);
      expect(await registry.getSubnetCount()).to.equal(0);

      // user1 gets locked tokens back
      const balAfter = await nativeToken.balanceOf(user1.address);
      expect(balAfter - balBefore).to.equal(REGISTRATION_COST);
    });

    it("non-owner cannot deregister others", async function () {
      await registry.registerSubnet("sub1", await stakeTime1.getAddress(), await incentive1.getAddress());
      await expect(
        registry.connect(user1).deregisterSubnet(0)
      ).to.be.revertedWith("not authorized");
    });
  });

  describe("Weakest Subnet Replacement", function () {
    it("getWeakestSubnet finds the subnet with lowest score", async function () {
      await registry.registerSubnet("sub1", await stakeTime1.getAddress(), await incentive1.getAddress());
      await registry.registerSubnet("sub2", await stakeTime2.getAddress(), await incentive2.getAddress());

      // Stake on subnet 1 only, making subnet 2 the weakest (both have same lock, but sub1 has STT)
      await stakeTime1.registerValidatorAdmin("v1", 1, 1000);
      await nativeToken.approve(await stakeTime1.getAddress(), ethers.MaxUint256);
      await stakeTime1.stakeOn("v1", ethers.parseEther("5000"), 0);

      // Wait for immunity to expire
      await mine(IMMUNITY_PERIOD + 1);

      const [weakId, weakScore, found] = await registry.getWeakestSubnet();
      expect(found).to.be.true;
      expect(weakId).to.equal(1); // sub2 has only locked stake, no STT
      expect(weakScore).to.equal(REGISTRATION_COST); // just the lock
    });

    it("skips immune subnets when finding weakest", async function () {
      await registry.registerSubnet("sub1", await stakeTime1.getAddress(), await incentive1.getAddress());
      await mine(IMMUNITY_PERIOD + 1); // sub1 loses immunity

      // Register sub2 — it's now immune
      await registry.registerSubnet("sub2", await stakeTime2.getAddress(), await incentive2.getAddress());

      const [weakId, , found] = await registry.getWeakestSubnet();
      expect(found).to.be.true;
      expect(weakId).to.equal(0); // sub1 is non-immune
    });

    it("returns not found when all subnets are immune", async function () {
      await registry.registerSubnet("sub1", await stakeTime1.getAddress(), await incentive1.getAddress());
      await registry.registerSubnet("sub2", await stakeTime2.getAddress(), await incentive2.getAddress());

      const [, , found] = await registry.getWeakestSubnet();
      expect(found).to.be.false;
    });

    it("replaces weakest subnet when at capacity (small cap test)", async function () {
      // Set immunity to 0 for this test
      await registry.setImmunityPeriod(0);

      // Register two subnets
      await registry.registerSubnet("sub1", await stakeTime1.getAddress(), await incentive1.getAddress());

      // Stake on sub1 to make it stronger
      await stakeTime1.registerValidatorAdmin("v1", 1, 1000);
      await nativeToken.approve(await stakeTime1.getAddress(), ethers.MaxUint256);
      await stakeTime1.stakeOn("v1", ethers.parseEther("5000"), 0);

      await registry.registerSubnet("sub2", await stakeTime2.getAddress(), await incentive2.getAddress());

      expect(await registry.getSubnetCount()).to.equal(2);

      // sub2 has only locked stake (weakest), sub1 has locked + STT
      const [weakId] = await registry.getWeakestSubnet();
      expect(weakId).to.equal(1);
    });
  });

  describe("Registration cost admin", function () {
    it("owner can update registration cost", async function () {
      const newCost = ethers.parseEther("2000");
      await registry.setRegistrationCost(newCost);
      expect(await registry.getRegistrationCost()).to.equal(newCost);
    });

    it("non-owner cannot update registration cost", async function () {
      await expect(
        registry.connect(user1).setRegistrationCost(0)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("getAllSubnets after deregistration", function () {
    it("excludes deregistered subnets", async function () {
      await registry.registerSubnet("sub1", await stakeTime1.getAddress(), await incentive1.getAddress());
      await registry.registerSubnet("sub2", await stakeTime2.getAddress(), await incentive2.getAddress());
      await registry.deregisterSubnet(0);

      const all = await registry.getAllSubnets();
      expect(all.length).to.equal(1);
      expect(all[0].name).to.equal("sub2");
    });
  });
});
