const { expect } = require("chai");
const { ethers } = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("StakeTime", function () {
  let stakeTime, subnet;
  let owner, user1, user2;

  const MAX_LOCK_BLOCKS = 100000;
  const MAX_STAKERS = 3;
  const DEFAULT_COMMISSION_BPS = 1000;
  const EPOCH_LENGTH = 50;
  const EMISSION_RATE = ethers.parseEther("100");
  const DECAY_BPS = 500;

  async function deployStakeTime(nativeToken, subnetAddr) {
    const StakeTime = await ethers.getContractFactory("StakeTime");
    const st = await StakeTime.deploy(
      nativeToken, subnetAddr, MAX_LOCK_BLOCKS, MAX_STAKERS,
      DEFAULT_COMMISSION_BPS, EPOCH_LENGTH, EMISSION_RATE, DECAY_BPS
    );
    await st.waitForDeployment();
    return st;
  }

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const Subnet = await ethers.getContractFactory("Subnet");
    subnet = await Subnet.deploy("TestNet", "TST", ethers.parseEther("1000000"));
    await subnet.waitForDeployment();

    stakeTime = await deployStakeTime(await subnet.getAddress(), await subnet.getAddress());

    // Set StakeTime as minter so it can mint emissions
    await subnet.setMinter(await stakeTime.getAddress());

    await stakeTime.registerValidatorAdmin("val1", 1, 1000);

    await subnet.transfer(user1.address, ethers.parseEther("10000"));
    await subnet.transfer(user2.address, ethers.parseEther("10000"));

    await subnet.connect(user1).approve(await stakeTime.getAddress(), ethers.MaxUint256);
    await subnet.connect(user2).approve(await stakeTime.getAddress(), ethers.MaxUint256);
  });

  describe("Deployment", function () {
    it("sets nativeToken to subnet address", async function () {
      expect(await stakeTime.nativeToken()).to.equal(await subnet.getAddress());
    });

    it("sets staking params", async function () {
      expect(await stakeTime.maxLockBlocks()).to.equal(MAX_LOCK_BLOCKS);
      expect(await stakeTime.maxStakersPerValidator()).to.equal(MAX_STAKERS);
      expect(await stakeTime.defaultCommissionBps()).to.equal(DEFAULT_COMMISSION_BPS);
    });

    it("sets consensus params", async function () {
      expect(await stakeTime.emissionRate()).to.equal(EMISSION_RATE);
      expect(await stakeTime.decayBps()).to.equal(DECAY_BPS);
    });

    it("has default 1x multiplier point", async function () {
      expect(await stakeTime.getMultiplier(0)).to.equal(10000);
    });

    it("mints STT ERC20 with correct name/symbol", async function () {
      expect(await stakeTime.name()).to.equal("StakeTime");
      expect(await stakeTime.symbol()).to.equal("STT");
    });
  });

  describe("Validator Registration", function () {
    it("registered validator is active", async function () {
      const v = await stakeTime.getValidator("val1");
      expect(v._key).to.equal("val1");
      expect(v._active).to.be.true;
      expect(v._commissionBps).to.equal(1000);
    });

    it("self-registers a validator", async function () {
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

  describe("Staking", function () {
    it("stakes on a validator and mints STT", async function () {
      const amount = ethers.parseEther("1000");
      await expect(stakeTime.connect(user1).stakeOn("val1", amount, 0))
        .to.emit(stakeTime, "Staked");
      expect(await stakeTime.balanceOf(user1.address)).to.equal(amount);
    });

    it("applies multiplier curve for longer lock", async function () {
      const st2 = await deployStakeTime(await subnet.getAddress(), await subnet.getAddress());
      await st2.registerValidatorAdmin("v1", 1, 1000);
      await st2.setPoints([
        { blocks: 0, multiplier: 10000 },
        { blocks: 10000, multiplier: 20000 },
      ]);

      await subnet.transfer(user1.address, ethers.parseEther("1000"));
      await subnet.connect(user1).approve(await st2.getAddress(), ethers.MaxUint256);
      await st2.connect(user1).stakeOn("v1", ethers.parseEther("1000"), 10000);
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
      await subnet.transfer(user3.address, ethers.parseEther("1000"));
      await subnet.transfer(user4.address, ethers.parseEther("1000"));
      await subnet.connect(user3).approve(await stakeTime.getAddress(), ethers.MaxUint256);
      await subnet.connect(user4).approve(await stakeTime.getAddress(), ethers.MaxUint256);

      await stakeTime.connect(user1).stakeOn("val1", ethers.parseEther("100"), 0);
      await stakeTime.connect(user2).stakeOn("val1", ethers.parseEther("100"), 0);
      await stakeTime.connect(user3).stakeOn("val1", ethers.parseEther("100"), 0);

      await expect(
        stakeTime.connect(user4).stakeOn("val1", ethers.parseEther("100"), 0)
      ).to.be.revertedWith("max stakers reached for this validator this epoch");
    });
  });

  describe("Unstaking", function () {
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

      const balBefore = await subnet.balanceOf(user1.address);
      await expect(stakeTime.connect(user1).unstakeFrom(ids[0]))
        .to.emit(stakeTime, "Unstaked");
      const balAfter = await subnet.balanceOf(user1.address);
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

  describe("Multiplier Curve", function () {
    let freshStakeTime;

    beforeEach(async function () {
      freshStakeTime = await deployStakeTime(await subnet.getAddress(), await subnet.getAddress());
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

  describe("Consensus: Checkin & Scoring", function () {
    it("checkin increments blocktimeScore", async function () {
      await stakeTime.batchCheckin(["val1"]);
      const s = await stakeTime.getValidatorScore(
        ethers.keccak256(ethers.toUtf8Bytes("val1"))
      );
      expect(s.blocktimeScore).to.be.gt(0);
    });

    it("batch checkin works for multiple validators", async function () {
      await stakeTime.connect(user1).registerValidator("val2", 0);
      await stakeTime.batchCheckin(["val1", "val2"]);

      const s1 = await stakeTime.getValidatorScore(
        ethers.keccak256(ethers.toUtf8Bytes("val1"))
      );
      const s2 = await stakeTime.getValidatorScore(
        ethers.keccak256(ethers.toUtf8Bytes("val2"))
      );
      expect(s1.blocktimeScore).to.be.gt(0);
      expect(s2.blocktimeScore).to.be.gt(0);
    });

    it("updates totalBlocktime", async function () {
      await stakeTime.batchCheckin(["val1"]);
      expect(await stakeTime.totalBlocktime()).to.be.gt(0);
    });
  });

  describe("Consensus: Emission Distribution", function () {
    it("distributes 100% to validator when no stakers", async function () {
      await stakeTime.batchCheckin(["val1"]);

      for (let i = 0; i < EPOCH_LENGTH; i++) {
        await stakeTime.produceBlock();
      }

      const vBal = await stakeTime.getValidatorBalance("val1");
      expect(vBal).to.be.gt(0);
    });

    it("mints new tokens for emissions (inflationary)", async function () {
      await stakeTime.batchCheckin(["val1"]);
      const supplyBefore = await subnet.totalSupply();

      for (let i = 0; i < EPOCH_LENGTH; i++) {
        await stakeTime.produceBlock();
      }

      const supplyAfter = await subnet.totalSupply();
      expect(supplyAfter).to.be.gt(supplyBefore);
    });

    it("splits emissions between validator commission and stakers", async function () {
      await stakeTime.batchCheckin(["val1"]);
      await stakeTime.connect(user1).stakeOn("val1", ethers.parseEther("1000"), 0);

      for (let i = 0; i < EPOCH_LENGTH; i++) {
        await stakeTime.produceBlock();
      }

      const vBal = await stakeTime.getValidatorBalance("val1");
      const sReward = await stakeTime.getStakerRewards(user1.address);

      expect(vBal).to.be.gt(0);
      expect(sReward).to.be.gt(0);
      expect(sReward).to.be.gt(vBal * BigInt(7));
    });

    it("rejects distribution before epoch", async function () {
      await stakeTime.batchCheckin(["val1"]);
      await stakeTime.produceBlock();
      await expect(stakeTime.distributeEmissions())
        .to.be.revertedWith("epoch not reached");
    });
  });

  describe("Consensus: Reward Claims", function () {
    beforeEach(async function () {
      await stakeTime.batchCheckin(["val1"]);
      await stakeTime.connect(user1).stakeOn("val1", ethers.parseEther("1000"), 0);

      for (let i = 0; i < EPOCH_LENGTH; i++) {
        await stakeTime.produceBlock();
      }
    });

    it("staker claims rewards", async function () {
      const reward = await stakeTime.getStakerRewards(user1.address);
      expect(reward).to.be.gt(0);

      const balBefore = await subnet.balanceOf(user1.address);
      await stakeTime.connect(user1).claimStakerRewards();
      const balAfter = await subnet.balanceOf(user1.address);

      expect(balAfter - balBefore).to.equal(reward);
      expect(await stakeTime.getStakerRewards(user1.address)).to.equal(0);
    });

    it("rejects claim with no rewards", async function () {
      await expect(
        stakeTime.connect(user2).claimStakerRewards()
      ).to.be.revertedWith("nothing to claim");
    });

    it("validator claims commission via owner (non-ECDSA)", async function () {
      const vBal = await stakeTime.getValidatorBalance("val1");
      expect(vBal).to.be.gt(0);

      const balBefore = await subnet.balanceOf(owner.address);
      await stakeTime.claimValidatorRewards("val1", owner.address);
      const balAfter = await subnet.balanceOf(owner.address);

      expect(balAfter - balBefore).to.equal(vBal);
    });
  });

  describe("Consensus: Block Production", function () {
    it("produces blocks and emits event", async function () {
      await stakeTime.batchCheckin(["val1"]);
      await expect(stakeTime.produceBlock())
        .to.emit(stakeTime, "BlockProduced");
    });

    it("rejects block production with no active validators", async function () {
      await expect(stakeTime.produceBlock())
        .to.be.revertedWith("no active validators");
    });

    it("auto-distributes at epoch boundary", async function () {
      await stakeTime.batchCheckin(["val1"]);

      for (let i = 0; i < EPOCH_LENGTH; i++) {
        await stakeTime.produceBlock();
      }

      const kh = ethers.keccak256(ethers.toUtf8Bytes("val1"));
      const s = await stakeTime.getValidatorScore(kh);
      expect(s.earned).to.be.gt(0);
    });
  });

  describe("Consensus: Leaderboard", function () {
    it("returns validators sorted by score", async function () {
      await stakeTime.connect(user1).registerValidator("low", 0);
      await stakeTime.batchCheckin(["val1"]);
      await mine(5);
      await stakeTime.batchCheckin(["val1"]);
      await stakeTime.batchCheckin(["low"]);

      const [keys, scores] = await stakeTime.getLeaderboard(2);
      expect(scores[0]).to.be.gte(scores[1]);
    });
  });

  describe("Integration: Full Flow", function () {
    it("register → stake → checkin → produce → mint → distribute → claim → unstake", async function () {
      await stakeTime.connect(user1).stakeOn("val1", ethers.parseEther("5000"), 0);
      expect(await stakeTime.balanceOf(user1.address)).to.equal(ethers.parseEther("5000"));

      await stakeTime.batchCheckin(["val1"]);

      const supplyBefore = await subnet.totalSupply();

      for (let i = 0; i < EPOCH_LENGTH; i++) {
        await stakeTime.produceBlock();
      }

      expect(await subnet.totalSupply()).to.be.gt(supplyBefore);

      const stakerReward = await stakeTime.getStakerRewards(user1.address);
      const validatorReward = await stakeTime.getValidatorBalance("val1");
      expect(stakerReward).to.be.gt(0);
      expect(validatorReward).to.be.gt(0);

      await stakeTime.connect(user1).claimStakerRewards();
      await stakeTime.claimValidatorRewards("val1", owner.address);

      expect(await stakeTime.getStakerRewards(user1.address)).to.equal(0);
      expect(await stakeTime.getValidatorBalance("val1")).to.equal(0);

      const ids = await stakeTime.getUserStakeIds(user1.address);
      await stakeTime.connect(user1).unstakeFrom(ids[0]);
      expect(await stakeTime.balanceOf(user1.address)).to.equal(0);
    });
  });
});
