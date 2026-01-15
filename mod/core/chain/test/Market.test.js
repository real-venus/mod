const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Market Integration", function () {
  let market, tokenGate, oracle, paymentToken, treasury, owner, user1;
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const TOKEN_PRICE = 100000000n; // $1 with 8 decimals

  beforeEach(async function () {
    [owner, treasury, user1] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Token");
    paymentToken = await Token.deploy("Payment Token", "PAY", INITIAL_SUPPLY);
    await paymentToken.waitForDeployment();

    const ManualPriceOracle = await ethers.getContractFactory("ManualPriceOracle");
    oracle = await ManualPriceOracle.deploy();
    await oracle.waitForDeployment();

    await oracle.setPrice(await paymentToken.getAddress(), TOKEN_PRICE, 8);

    const TokenGate = await ethers.getContractFactory("TokenGate");
    tokenGate = await TokenGate.deploy(await oracle.getAddress());
    await tokenGate.waitForDeployment();

    await tokenGate.whitelistToken(await paymentToken.getAddress());

    const Market = await ethers.getContractFactory("Market");
    market = await Market.deploy(
      "Stable Token",
      "STABLE",
      treasury.address,
      await tokenGate.getAddress()
    );
    await market.waitForDeployment();

    await paymentToken.transfer(user1.address, ethers.parseEther("10000"));
  });

  describe("TokenGate Integration", function () {
    it("Should set tokenGate correctly", async function () {
      expect(await market.tokenGate()).to.equal(await tokenGate.getAddress());
    });

    it("Should update tokenGate", async function () {
      const TokenGate = await ethers.getContractFactory("TokenGate");
      const newTokenGate = await TokenGate.deploy(await oracle.getAddress());
      await newTokenGate.waitForDeployment();

      await expect(market.setTokenGate(await newTokenGate.getAddress()))
        .to.emit(market, "TokenGateUpdated");

      expect(await market.tokenGate()).to.equal(await newTokenGate.getAddress());
    });
  });

  describe("Token Whitelist via TokenGate", function () {
    it("Should check token whitelist via TokenGate", async function () {
      expect(await market.isTokenWhitelisted(await paymentToken.getAddress())).to.be.true;
    });

    it("Should reject non-whitelisted token", async function () {
      const Token = await ethers.getContractFactory("Token");
      const badToken = await Token.deploy("Bad", "BAD", INITIAL_SUPPLY);
      await badToken.waitForDeployment();

      expect(await market.isTokenWhitelisted(await badToken.getAddress())).to.be.false;
    });

    it("Should get token price from TokenGate oracle", async function () {
      const [price, decimals] = await market.getTokenPrice(await paymentToken.getAddress());
      expect(price).to.equal(TOKEN_PRICE);
      expect(decimals).to.equal(8);
    });
  });

  describe("Credit with TokenGate Pricing", function () {
    const stableAmount = 100000000n; // $1 with 8 decimals

    it("Should credit with TokenGate oracle-based pricing", async function () {
      const paymentAmount = (stableAmount * ethers.parseEther("1")) / TOKEN_PRICE;
      
      await paymentToken.connect(user1).approve(await market.getAddress(), paymentAmount);
      
      await expect(market.connect(user1).credit(await paymentToken.getAddress(), stableAmount))
        .to.emit(market, "Credit");

      expect(await market.balanceOf(user1.address)).to.equal(stableAmount);
    });

    it("Should handle dynamic oracle price updates via TokenGate", async function () {
      const newPrice = 200000000n; // $2 with 8 decimals
      await oracle.setPrice(await paymentToken.getAddress(), newPrice, 8);

      const paymentAmount = (stableAmount * ethers.parseEther("1")) / newPrice;
      
      await paymentToken.connect(user1).approve(await market.getAddress(), paymentAmount);
      await market.connect(user1).credit(await paymentToken.getAddress(), stableAmount);

      expect(await market.balanceOf(user1.address)).to.equal(stableAmount);
    });

    it("Should reject credit with non-whitelisted token", async function () {
      const Token = await ethers.getContractFactory("Token");
      const badToken = await Token.deploy("Bad", "BAD", INITIAL_SUPPLY);
      await badToken.waitForDeployment();

      await expect(
        market.connect(user1).credit(await badToken.getAddress(), stableAmount)
      ).to.be.revertedWith("Token not whitelisted");
    });
  });

  describe("Debit Functionality", function () {
    const stableAmount = 100000000n;

    beforeEach(async function () {
      const paymentAmount = (stableAmount * ethers.parseEther("1")) / TOKEN_PRICE;
      await paymentToken.connect(user1).approve(await market.getAddress(), paymentAmount);
      await market.connect(user1).credit(await paymentToken.getAddress(), stableAmount);
    });

    it("Should debit stable tokens correctly", async function () {
      await expect(market.connect(user1).debit(user1.address, stableAmount))
        .to.emit(market, "Debit");

      expect(await market.balanceOf(user1.address)).to.equal(0);
    });

    it("Should reject debit with insufficient balance", async function () {
      await expect(
        market.connect(user1).debit(user1.address, stableAmount * 2n)
      ).to.be.revertedWith("Insufficient balance");
    });
  });
});
