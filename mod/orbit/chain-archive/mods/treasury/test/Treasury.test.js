const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Treasury", function () {
  let treasury, tokenGate, oracle, usdc, govToken, owner, holder1, holder2;
  const SUPPLY = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, holder1, holder2] = await ethers.getSigners();

    // Deploy oracle
    const Oracle = await ethers.getContractFactory("ManualPriceOracle");
    oracle = await Oracle.deploy();
    await oracle.waitForDeployment();

    // Deploy USDC
    const Token = await ethers.getContractFactory("Token");
    usdc = await Token.deploy("USDC", "USDC", SUPPLY);
    await usdc.waitForDeployment();
    await oracle.setPrice(await usdc.getAddress(), 100000000, 8);

    // Deploy governance token
    govToken = await Token.deploy("GOV", "GOV", SUPPLY);
    await govToken.waitForDeployment();

    // Deploy TokenGate
    const TokenGate = await ethers.getContractFactory("TokenGate");
    tokenGate = await TokenGate.deploy(await oracle.getAddress());
    await tokenGate.waitForDeployment();
    await tokenGate.whitelistToken(await usdc.getAddress());

    // Deploy Treasury (10% owner cut)
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(1000, await tokenGate.getAddress());
    await treasury.waitForDeployment();

    // Set governance token
    await treasury.setGovernanceToken(await govToken.getAddress());

    // Distribute governance tokens: holder1 gets 60%, holder2 gets 40%
    await govToken.transfer(holder1.address, ethers.parseEther("600000"));
    await govToken.transfer(holder2.address, ethers.parseEther("400000"));
  });

  describe("Deployment", function () {
    it("Should set owner percentage", async function () {
      expect(await treasury.ownerPercentage()).to.equal(1000);
    });

    it("Should set token gate", async function () {
      expect(await treasury.tokenGate()).to.equal(await tokenGate.getAddress());
    });

    it("Should reject owner percentage over 100%", async function () {
      const Treasury = await ethers.getContractFactory("Treasury");
      await expect(
        Treasury.deploy(10001, await tokenGate.getAddress())
      ).to.be.revertedWith("Max 100%");
    });
  });

  describe("Fund Treasury", function () {
    it("Should accept whitelisted token deposits", async function () {
      const amount = ethers.parseEther("1000");
      await usdc.approve(await treasury.getAddress(), amount);
      await expect(treasury.fundTreasury(await usdc.getAddress(), amount))
        .to.emit(treasury, "TreasuryFunded");

      expect(await usdc.balanceOf(await treasury.getAddress())).to.equal(amount);
    });

    it("Should reject non-whitelisted token", async function () {
      const Token = await ethers.getContractFactory("Token");
      const fake = await Token.deploy("FAKE", "F", 1000);
      await fake.waitForDeployment();

      await expect(
        treasury.fundTreasury(await fake.getAddress(), 100)
      ).to.be.revertedWith("Token not whitelisted");
    });

    it("Should reject zero amount", async function () {
      await expect(
        treasury.fundTreasury(await usdc.getAddress(), 0)
      ).to.be.revertedWith("Amount must be > 0");
    });
  });

  describe("Claimable Amounts", function () {
    beforeEach(async function () {
      // Fund treasury with 1000 USDC
      const amount = ethers.parseEther("1000");
      await usdc.approve(await treasury.getAddress(), amount);
      await treasury.fundTreasury(await usdc.getAddress(), amount);
    });

    it("Should calculate holder claimable correctly", async function () {
      // holder1 has 60% of gov tokens, owner gets 10%, so distributable = 90%
      // holder1 gets 60% of 900 = 540
      const claimable = await treasury.getClaimableAmount(
        holder1.address, await usdc.getAddress()
      );
      expect(claimable).to.equal(ethers.parseEther("540"));
    });

    it("Should calculate owner claimable correctly", async function () {
      const ownerClaimable = await treasury.getOwnerClaimableAmount(await usdc.getAddress());
      expect(ownerClaimable).to.equal(ethers.parseEther("100")); // 10% of 1000
    });
  });

  describe("Withdrawals", function () {
    beforeEach(async function () {
      const amount = ethers.parseEther("1000");
      await usdc.approve(await treasury.getAddress(), amount);
      await treasury.fundTreasury(await usdc.getAddress(), amount);
    });

    it("Should allow holder withdrawal", async function () {
      const before = await usdc.balanceOf(holder1.address);
      await treasury.connect(holder1).withdrawToken(await usdc.getAddress());
      const after_ = await usdc.balanceOf(holder1.address);
      expect(after_ - before).to.equal(ethers.parseEther("540"));
    });

    it("Should allow owner withdrawal", async function () {
      const before = await usdc.balanceOf(owner.address);
      await treasury.ownerWithdraw(await usdc.getAddress());
      const after_ = await usdc.balanceOf(owner.address);
      expect(after_ - before).to.equal(ethers.parseEther("100"));
    });
  });

  describe("Admin", function () {
    it("Should update owner percentage", async function () {
      await treasury.setOwnerPercentage(2000);
      expect(await treasury.ownerPercentage()).to.equal(2000);
    });

    it("Should reject setting governance token twice", async function () {
      await expect(
        treasury.setGovernanceToken(await usdc.getAddress())
      ).to.be.revertedWith("Already set");
    });

    it("Should emergency withdraw", async function () {
      await usdc.transfer(await treasury.getAddress(), ethers.parseEther("100"));
      await treasury.emergencyWithdraw(await usdc.getAddress(), ethers.parseEther("100"));
    });
  });
});
