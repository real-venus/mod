const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiTokenTreasury", function () {
  let treasury, governanceToken, token1, token2, owner, user1, user2;
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const OWNER_PERCENTAGE = 2000; // 20%

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Token");
    governanceToken = await Token.deploy("Governance", "GOV", INITIAL_SUPPLY);
    await governanceToken.waitForDeployment();

    token1 = await Token.deploy("Token1", "TK1", INITIAL_SUPPLY);
    await token1.waitForDeployment();

    token2 = await Token.deploy("Token2", "TK2", INITIAL_SUPPLY);
    await token2.waitForDeployment();

    const Treasury = await ethers.getContractFactory("MultiTokenTreasury");
    treasury = await Treasury.deploy(OWNER_PERCENTAGE);
    await treasury.waitForDeployment();

    await treasury.setGovernanceToken(await governanceToken.getAddress());
    await treasury.addTreasuryToken(await token1.getAddress());
    await treasury.addTreasuryToken(await token2.getAddress());

    await governanceToken.transfer(user1.address, ethers.parseEther("200000"));
    await governanceToken.transfer(user2.address, ethers.parseEther("300000"));
  });

  describe("Deployment", function () {
    it("Should set correct owner percentage", async function () {
      expect(await treasury.ownerPercentage()).to.equal(OWNER_PERCENTAGE);
    });

    it("Should set governance token", async function () {
      expect(await treasury.governanceToken()).to.equal(await governanceToken.getAddress());
    });

    it("Should add treasury tokens", async function () {
      const tokens = await treasury.getTreasuryTokens();
      expect(tokens.length).to.equal(2);
    });
  });

  describe("Funding", function () {
    const fundAmount = ethers.parseEther("1000");

    it("Should fund treasury correctly", async function () {
      await token1.approve(await treasury.getAddress(), fundAmount);
      
      await expect(treasury.fundTreasury(await token1.getAddress(), fundAmount))
        .to.emit(treasury, "TreasuryFunded");

      expect(await token1.balanceOf(await treasury.getAddress())).to.equal(fundAmount);
    });

    it("Should reject non-treasury token", async function () {
      const Token = await ethers.getContractFactory("Token");
      const badToken = await Token.deploy("Bad", "BAD", INITIAL_SUPPLY);
      
      await expect(
        treasury.fundTreasury(await badToken.getAddress(), fundAmount)
      ).to.be.revertedWith("Token not in treasury");
    });
  });

  describe("Owner Withdrawal", function () {
    const fundAmount = ethers.parseEther("1000");

    beforeEach(async function () {
      await token1.approve(await treasury.getAddress(), fundAmount);
      await treasury.fundTreasury(await token1.getAddress(), fundAmount);
    });

    it("Should calculate owner claimable correctly", async function () {
      const claimable = await treasury.getOwnerClaimableAmount(await token1.getAddress());
      const expected = (fundAmount * BigInt(OWNER_PERCENTAGE)) / 10000n;
      expect(claimable).to.equal(expected);
    });

    it("Should allow owner to withdraw", async function () {
      await expect(treasury.ownerWithdraw(await token1.getAddress()))
        .to.emit(treasury, "OwnerWithdrawn");

      const claimed = await treasury.ownerClaimed(await token1.getAddress());
      expect(claimed).to.be.gt(0);
    });
  });

  describe("Holder Withdrawal", function () {
    const fundAmount = ethers.parseEther("1000");

    beforeEach(async function () {
      await token1.approve(await treasury.getAddress(), fundAmount);
      await treasury.fundTreasury(await token1.getAddress(), fundAmount);
    });

    it("Should calculate claimable amount correctly", async function () {
      const claimable = await treasury.getClaimableAmount(user1.address, await token1.getAddress());
      expect(claimable).to.be.gt(0);
    });

    it("Should allow holder to withdraw", async function () {
      await expect(treasury.connect(user1).withdrawToken(await token1.getAddress()))
        .to.emit(treasury, "Withdrawn");

      const claimed = await treasury.claimed(user1.address, await token1.getAddress());
      expect(claimed).to.be.gt(0);
    });

    it("Should withdraw all tokens", async function () {
      await token2.approve(await treasury.getAddress(), fundAmount);
      await treasury.fundTreasury(await token2.getAddress(), fundAmount);

      await treasury.connect(user1).withdrawAll();

      const claimed1 = await treasury.claimed(user1.address, await token1.getAddress());
      const claimed2 = await treasury.claimed(user1.address, await token2.getAddress());
      
      expect(claimed1).to.be.gt(0);
      expect(claimed2).to.be.gt(0);
    });
  });

  describe("Proportional Distribution", function () {
    const fundAmount = ethers.parseEther("1000");

    beforeEach(async function () {
      await token1.approve(await treasury.getAddress(), fundAmount);
      await treasury.fundTreasury(await token1.getAddress(), fundAmount);
    });

    it("Should distribute proportionally to holders", async function () {
      const claimable1 = await treasury.getClaimableAmount(user1.address, await token1.getAddress());
      const claimable2 = await treasury.getClaimableAmount(user2.address, await token1.getAddress());

      const balance1 = await governanceToken.balanceOf(user1.address);
      const balance2 = await governanceToken.balanceOf(user2.address);

      // user1: 200000, user2: 300000 -> ratio should be 2:3
      // claimable1/claimable2 should equal balance1/balance2
      // Cross multiply: claimable1 * balance2 should equal claimable2 * balance1
      const leftSide = claimable1 * balance2;
      const rightSide = claimable2 * balance1;
      
      // Convert to numbers for comparison with tolerance
      const ratio = Number(leftSide * 10000n / rightSide);
      expect(ratio).to.be.closeTo(10000, 100);
    });
  });
});
