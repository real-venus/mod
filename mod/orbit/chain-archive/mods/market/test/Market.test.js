const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Market", function () {
  let market, tokenGate, oracle, usdc, owner, user1, treasury;
  const SUPPLY = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, user1, treasury] = await ethers.getSigners();

    // Deploy oracle
    const Oracle = await ethers.getContractFactory("ManualPriceOracle");
    oracle = await Oracle.deploy();
    await oracle.waitForDeployment();

    // Deploy USDC mock
    const Token = await ethers.getContractFactory("Token");
    usdc = await Token.deploy("USDC", "USDC", SUPPLY);
    await usdc.waitForDeployment();

    // Set oracle price: $1.00 with 8 decimals
    await oracle.setPrice(await usdc.getAddress(), 100000000, 8);

    // Deploy TokenGate
    const TokenGate = await ethers.getContractFactory("TokenGate");
    tokenGate = await TokenGate.deploy(await oracle.getAddress());
    await tokenGate.waitForDeployment();

    // Whitelist USDC
    await tokenGate.whitelistToken(await usdc.getAddress());

    // Deploy Market
    const Market = await ethers.getContractFactory("Market");
    market = await Market.deploy(
      "Market Token",
      "MKT",
      treasury.address,
      await tokenGate.getAddress()
    );
    await market.waitForDeployment();

    // Fund user with USDC
    await usdc.transfer(user1.address, ethers.parseEther("10000"));
  });

  describe("Deployment", function () {
    it("Should set treasury", async function () {
      expect(await market.treasury()).to.equal(treasury.address);
    });

    it("Should set token gate", async function () {
      expect(await market.tokenGate()).to.equal(await tokenGate.getAddress());
    });

    it("Should have 8 decimals", async function () {
      expect(await market.decimals()).to.equal(8);
    });

    it("Should reject zero treasury", async function () {
      const Market = await ethers.getContractFactory("Market");
      await expect(
        Market.deploy("M", "M", ethers.ZeroAddress, await tokenGate.getAddress())
      ).to.be.revertedWith("Invalid treasury");
    });
  });

  describe("Credit", function () {
    it("Should credit market tokens", async function () {
      const stableAmount = 10000000000n; // 100 tokens (8 decimals)
      const maxPayment = ethers.parseEther("200");

      await usdc.connect(user1).approve(await market.getAddress(), maxPayment);
      await expect(
        market.connect(user1).credit(await usdc.getAddress(), stableAmount, maxPayment)
      ).to.emit(market, "Credit");

      const balance = await market.balanceOf(user1.address);
      expect(balance).to.be.gt(0);
    });

    it("Should reject non-whitelisted token", async function () {
      const Token2 = await ethers.getContractFactory("Token");
      const fake = await Token2.deploy("FAKE", "FAKE", 1000);
      await fake.waitForDeployment();

      await expect(
        market.connect(user1).credit(await fake.getAddress(), 100, 200)
      ).to.be.revertedWith("Token not whitelisted");
    });

    it("Should reject zero amount", async function () {
      await expect(
        market.connect(user1).credit(await usdc.getAddress(), 0, 100)
      ).to.be.revertedWith("Invalid amount");
    });
  });

  describe("Admin", function () {
    it("Should update treasury", async function () {
      await market.setTreasury(user1.address);
      expect(await market.treasury()).to.equal(user1.address);
    });

    it("Should update credit fee", async function () {
      await market.setCreditFee(200); // 2%
      expect(await market.creditFeeBps()).to.equal(200);
    });

    it("Should reject fee over 100%", async function () {
      await expect(market.setCreditFee(10001)).to.be.revertedWith("Max 100%");
    });

    it("Should pause and unpause", async function () {
      await market.pause();
      await usdc.connect(user1).approve(await market.getAddress(), ethers.parseEther("100"));
      await expect(
        market.connect(user1).credit(await usdc.getAddress(), 100, 200)
      ).to.be.revertedWith("Pausable: paused");

      await market.unpause();
    });

    it("Should reject admin calls from non-owner", async function () {
      await expect(
        market.connect(user1).setTreasury(user1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Set Ownerless", function () {
    it("Should renounce ownership", async function () {
      await market.setOwnerless();
      expect(await market.owner()).to.equal(ethers.ZeroAddress);
    });
  });
});
