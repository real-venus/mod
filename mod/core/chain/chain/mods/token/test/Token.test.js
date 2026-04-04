const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Token", function () {
  let token, owner, user1, user2;
  const SUPPLY = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Test Token", "TST", SUPPLY);
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set name and symbol", async function () {
      expect(await token.name()).to.equal("Test Token");
      expect(await token.symbol()).to.equal("TST");
    });

    it("Should mint initial supply to deployer", async function () {
      expect(await token.balanceOf(owner.address)).to.equal(SUPPLY);
    });

    it("Should set total supply", async function () {
      expect(await token.totalSupply()).to.equal(SUPPLY);
    });
  });

  describe("Transfers", function () {
    it("Should transfer tokens", async function () {
      const amount = ethers.parseEther("100");
      await token.transfer(user1.address, amount);
      expect(await token.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should fail transfer with insufficient balance", async function () {
      const amount = SUPPLY + 1n;
      await expect(
        token.transfer(user1.address, amount)
      ).to.be.reverted;
    });
  });

  describe("Approvals", function () {
    it("Should approve and transferFrom", async function () {
      const amount = ethers.parseEther("100");
      await token.approve(user1.address, amount);
      expect(await token.allowance(owner.address, user1.address)).to.equal(amount);

      await token.connect(user1).transferFrom(owner.address, user2.address, amount);
      expect(await token.balanceOf(user2.address)).to.equal(amount);
    });
  });
});
