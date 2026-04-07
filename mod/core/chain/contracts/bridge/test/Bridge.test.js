const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Bridge", function () {
  let bridge, token, owner, user1, relayer;
  const INITIAL_SUPPLY = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, user1, relayer] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Test Token", "TST", INITIAL_SUPPLY);
    await token.waitForDeployment();

    const Bridge = await ethers.getContractFactory("Bridge");
    bridge = await Bridge.deploy();
    await bridge.waitForDeployment();

    await token.transfer(user1.address, ethers.parseEther("10000"));
  });

  describe("Deployment", function () {
    it("Should deploy bridge contract", async function () {
      expect(await bridge.getAddress()).to.properAddress;
    });

    it("Should set deployer as owner", async function () {
      expect(await bridge.owner()).to.equal(owner.address);
    });
  });

  describe("Bridge Operations", function () {
    it("Should allow token deposits", async function () {
      const amount = ethers.parseEther("100");
      await token.connect(user1).approve(await bridge.getAddress(), amount);

      await expect(
        bridge.connect(user1).deposit(await token.getAddress(), amount, 8453)
      ).to.emit(bridge, "Deposited");
    });

    it("Should track deposit nonces", async function () {
      const amount = ethers.parseEther("100");
      await token.connect(user1).approve(await bridge.getAddress(), amount * 2n);

      await bridge.connect(user1).deposit(await token.getAddress(), amount, 8453);
      await bridge.connect(user1).deposit(await token.getAddress(), amount, 8453);

      expect(await bridge.nonce()).to.equal(2);
    });
  });
});
