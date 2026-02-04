const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Market Integration", function () {
  let market, tokenGate, oracle, paymentToken, treasury, owner, user1;
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const TOKEN_PRICE = 100000000n; // $1.00 with 8 decimals

  beforeEach(async function () {
    [owner, treasury, user1] = await ethers.getSigners();

    // Deploy payment token (18 decimals)
    const Token = await ethers.getContractFactory("Token");
    paymentToken = await Token.deploy("Payment Token", "PAY", INITIAL_SUPPLY);
    await paymentToken.waitForDeployment();

    // Deploy oracle
    const ManualPriceOracle = await ethers.getContractFactory("ManualPriceOracle");
    oracle = await ManualPriceOracle.deploy();
    await oracle.waitForDeployment();

    // Set $1 price for payment token (8 decimals)
    await oracle.setPrice(await paymentToken.getAddress(), TOKEN_PRICE, 18);

    // Deploy TokenGate
    const TokenGate = await ethers.getContractFactory("TokenGate");
    tokenGate = await TokenGate.deploy(await oracle.getAddress());
    await tokenGate.waitForDeployment();

    // Whitelist payment token
    await tokenGate.whitelistToken(await paymentToken.getAddress());

    // Deploy Market (8 decimals)
    const Market = await ethers.getContractFactory("Market");
    market = await Market.deploy(
      "Stable Token",
      "STABLE",
      treasury.address,
      await tokenGate.getAddress()
    );
    await market.waitForDeployment();

    // Fund user and treasury
    await paymentToken.transfer(user1.address, ethers.parseEther("10000"));
    await paymentToken.transfer(treasury.address, ethers.parseEther("100000"));
  });

  describe("Decimals", function () {
    it("Should have 8 decimals", async function () {
      expect(await market.decimals()).to.equal(8);
    });
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
      expect(decimals).to.equal(18);
    });
  });

  describe("Credit with TokenGate Pricing", function () {
    const stableAmount = 10000000000n; // 100 tokens at 8 decimals

    it("Should credit with TokenGate oracle-based pricing", async function () {
      // Market is 8 decimals, payment token is 18 decimals, price is 8 decimals
      // paymentAmount = stableAmount * 10^18 / TOKEN_PRICE
      const paymentAmount = (stableAmount * BigInt(10 ** 18)) / TOKEN_PRICE;

      await paymentToken.connect(user1).approve(await market.getAddress(), paymentAmount);

      await expect(market.connect(user1).credit(await paymentToken.getAddress(), stableAmount))
        .to.emit(market, "Credit");

      expect(await market.balanceOf(user1.address)).to.equal(stableAmount);
    });

    it("Should handle dynamic oracle price updates via TokenGate", async function () {
      const newPrice = 200000000n; // $2.00 with 8 decimals
      await oracle.setPrice(await paymentToken.getAddress(), newPrice, 18);

      const paymentAmount = (stableAmount * BigInt(10 ** 18)) / newPrice;

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
    const stableAmount = 10000000000n; // 100 tokens at 8 decimals

    beforeEach(async function () {
      const paymentAmount = (stableAmount * BigInt(10 ** 18)) / TOKEN_PRICE;
      await paymentToken.connect(user1).approve(await market.getAddress(), paymentAmount);
      await market.connect(user1).credit(await paymentToken.getAddress(), stableAmount);
    });

    it("Should debit stable tokens correctly", async function () {
      await expect(market.connect(user1).debit(stableAmount))
        .to.emit(market, "Debit");

      expect(await market.balanceOf(user1.address)).to.equal(0);
    });

    it("Should reject debit with insufficient balance", async function () {
      await expect(
        market.connect(user1).debit(stableAmount * 2n)
      ).to.be.revertedWith("Insufficient balance");
    });
  });

  describe("Withdrawal Tests", function () {
    const stableAmount = 10000000000n; // 100 tokens at 8 decimals

    beforeEach(async function () {
      const paymentAmount = (stableAmount * BigInt(10 ** 18)) / TOKEN_PRICE;
      await paymentToken.connect(user1).approve(await market.getAddress(), paymentAmount);
      await market.connect(user1).credit(await paymentToken.getAddress(), stableAmount);
    });

    it("Should allow immediate withdrawal without lockup", async function () {
      const paymentAmount = (stableAmount * BigInt(10 ** 18)) / TOKEN_PRICE;

      // Approve treasury to send back payment tokens
      await paymentToken.connect(treasury).approve(await market.getAddress(), paymentAmount);

      await expect(market.connect(user1).withdraw(await paymentToken.getAddress(), stableAmount))
        .to.emit(market, "Withdrawal");

      expect(await market.balanceOf(user1.address)).to.equal(0);
    });

    it("Should return full amount with NO withdrawal fee", async function () {
      const userBalanceBefore = await paymentToken.balanceOf(user1.address);
      const paymentAmount = (stableAmount * BigInt(10 ** 18)) / TOKEN_PRICE;

      await paymentToken.connect(treasury).approve(await market.getAddress(), paymentAmount);
      await market.connect(user1).withdraw(await paymentToken.getAddress(), stableAmount);

      const userBalanceAfter = await paymentToken.balanceOf(user1.address);

      expect(userBalanceAfter - userBalanceBefore).to.equal(paymentAmount);
    });

    it("Should require sufficient balance for withdrawal", async function () {
      const paymentAmount = (stableAmount * BigInt(10 ** 18)) / TOKEN_PRICE;

      await paymentToken.connect(treasury).approve(await market.getAddress(), paymentAmount);

      await expect(
        market.connect(user1).withdraw(await paymentToken.getAddress(), stableAmount * 2n)
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should require whitelisted token for withdrawal", async function () {
      const Token = await ethers.getContractFactory("Token");
      const badToken = await Token.deploy("Bad", "BAD", INITIAL_SUPPLY);
      await badToken.waitForDeployment();

      await expect(
        market.connect(user1).withdraw(await badToken.getAddress(), stableAmount)
      ).to.be.revertedWith("Token not whitelisted");
    });

    it("Should burn stable tokens on withdrawal", async function () {
      const balanceBefore = await market.balanceOf(user1.address);

      const paymentAmount = (stableAmount * BigInt(10 ** 18)) / TOKEN_PRICE;
      await paymentToken.connect(treasury).approve(await market.getAddress(), paymentAmount);
      await market.connect(user1).withdraw(await paymentToken.getAddress(), stableAmount);

      const balanceAfter = await market.balanceOf(user1.address);
      expect(balanceAfter).to.equal(balanceBefore - stableAmount);
    });

    it("Should handle withdrawal with dynamic price changes", async function () {
      const newPrice = 200000000n; // $2.00
      await oracle.setPrice(await paymentToken.getAddress(), newPrice, 18);

      const paymentAmount = (stableAmount * BigInt(10 ** 18)) / newPrice;

      await paymentToken.connect(treasury).approve(await market.getAddress(), paymentAmount);
      await market.connect(user1).withdraw(await paymentToken.getAddress(), stableAmount);

      expect(await market.balanceOf(user1.address)).to.equal(0);
    });

    it("Should handle zero withdrawal amount", async function () {
      await expect(
        market.connect(user1).withdraw(await paymentToken.getAddress(), 0)
      ).to.be.revertedWith("Invalid amount");
    });
  });
});
