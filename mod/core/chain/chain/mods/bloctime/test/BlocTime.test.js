const { expect } = require("chai");
const { ethers } = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("BlocTime", function () {
  let bloctime, nativeToken, owner, user1;
  const SUPPLY = ethers.parseEther("1000000");
  const MAX_LOCK = 100000;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    // Deploy native token
    const Token = await ethers.getContractFactory("Token");
    nativeToken = await Token.deploy("Native", "NAT", SUPPLY);
    await nativeToken.waitForDeployment();

    // Deploy BlocTime
    const BlocTime = await ethers.getContractFactory("BlocTime");
    bloctime = await BlocTime.deploy(
      await nativeToken.getAddress(),
      "BlocTime",
      "BLT",
      MAX_LOCK,
      5000 // 50%
    );
    await bloctime.waitForDeployment();

    // Fund user
    await nativeToken.transfer(user1.address, ethers.parseEther("10000"));
    await nativeToken.connect(user1).approve(
      await bloctime.getAddress(),
      ethers.parseEther("10000")
    );
  });

  describe("Deployment", function () {
    it("Should set native token", async function () {
      expect(await bloctime.nativeToken()).to.equal(await nativeToken.getAddress());
    });

    it("Should set params", async function () {
      const params = await bloctime.params();
      expect(params.maxLockBlocks).to.equal(MAX_LOCK);
      expect(params.distributionPercentage).to.equal(5000);
    });

    it("Should have default point (1x at 0 blocks)", async function () {
      expect(await bloctime.getMultiplier(0)).to.equal(10000);
    });
  });

  describe("Staking", function () {
    it("Should stake tokens", async function () {
      const amount = ethers.parseEther("100");
      await expect(bloctime.connect(user1).stake(amount, 100))
        .to.emit(bloctime, "Staked");

      const ids = await bloctime.getUserStakeIds(user1.address);
      expect(ids.length).to.equal(1);
    });

    it("Should mint bloctime tokens on stake", async function () {
      const amount = ethers.parseEther("100");
      await bloctime.connect(user1).stake(amount, 0);
      // 1x multiplier at 0 blocks -> 100 BLT
      expect(await bloctime.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should reject zero amount", async function () {
      await expect(
        bloctime.connect(user1).stake(0, 100)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("Should reject exceeding max lock blocks", async function () {
      await expect(
        bloctime.connect(user1).stake(ethers.parseEther("100"), MAX_LOCK + 1)
      ).to.be.revertedWith("Exceeds max lock blocks");
    });
  });

  describe("Unstaking", function () {
    beforeEach(async function () {
      await bloctime.connect(user1).stake(ethers.parseEther("100"), 10);
    });

    it("Should reject unstake while locked", async function () {
      await expect(
        bloctime.connect(user1).unstake(0)
      ).to.be.revertedWith("Still locked");
    });

    it("Should unstake after lock period", async function () {
      await mine(10);
      await expect(bloctime.connect(user1).unstake(0))
        .to.emit(bloctime, "Unstaked");

      expect(await nativeToken.balanceOf(user1.address)).to.equal(ethers.parseEther("10000"));
      expect(await bloctime.balanceOf(user1.address)).to.equal(0);
    });
  });

  describe("Multiplier Points", function () {
    it("Should set points", async function () {
      await bloctime.setPoints([
        { blocks: 0, multiplier: 10000 },
        { blocks: 50000, multiplier: 20000 },
        { blocks: 100000, multiplier: 40000 },
      ]);
      expect(await bloctime.getMultiplier(0)).to.equal(10000);
      expect(await bloctime.getMultiplier(100000)).to.equal(40000);
    });

    it("Should interpolate between points", async function () {
      await bloctime.setPoints([
        { blocks: 0, multiplier: 10000 },
        { blocks: 100000, multiplier: 20000 },
      ]);
      // Midpoint should be ~15000
      expect(await bloctime.getMultiplier(50000)).to.equal(15000);
    });

    it("Should reject non-monotonic blocks", async function () {
      await expect(
        bloctime.setPoints([
          { blocks: 100, multiplier: 10000 },
          { blocks: 50, multiplier: 20000 },
        ])
      ).to.be.revertedWith("Blocks must be monotonically increasing");
    });
  });

  describe("Params", function () {
    it("Should update params", async function () {
      await bloctime.setParams(200000, 7500);
      const params = await bloctime.params();
      expect(params.maxLockBlocks).to.equal(200000);
      expect(params.distributionPercentage).to.equal(7500);
    });

    it("Should reject percentage over 100%", async function () {
      await expect(
        bloctime.setParams(100000, 10001)
      ).to.be.revertedWith("Max 100%");
    });
  });
});
