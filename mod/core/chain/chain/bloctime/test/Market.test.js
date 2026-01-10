const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Market", function () {
  let market, paymentToken, treasury, owner, user1, user2;
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const TOKEN_PRICE = 100000000n; // $1 with 8 decimals

  beforeEach(async function () {
    [owner, treasury, user1, user2] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Token");
    paymentToken = await Token.deploy("Payment Token", "PAY", INITIAL_SUPPLY);
    await paymentToken.waitForDeployment();

    const Market = await ethers.getContractFactory("Market");
    market = await Market.deploy("Stable Token", "STABLE", treasury.address);
    await market.waitForDeployment();

    await paymentToken.transfer(user1.address, ethers.parseEther("10000"));
    await paymentToken.transfer(user2.address, ethers.parseEther("10000"));
  });

  describe("Deployment", function () {
    it("Should set correct treasury", async function () {
      expect(await market.treasury()).to.equal(treasury.address);
    });

    it("Should have 8 decimals", async function () {
      expect(await market.decimals()).to.equal(8);
    });
  });

  describe("Token Whitelist", function () {
    it("Should set prices correctly", async function () {
      await market.setPrices(
        [await paymentToken.getAddress()],
        [TOKEN_PRICE],
        [18]
      );

      expect(await market.isTokenModed(await paymentToken.getAddress())).to.be.true;
      
      const [price, decimals] = await market.getTokenPrice(await paymentToken.getAddress());
      expect(price).to.equal(TOKEN_PRICE);
      expect(decimals).to.equal(18);
    });

    it("Should reject invalid prices", async function () {
      await expect(
        market.setPrices([await paymentToken.getAddress()], [0], [18])
      ).to.be.revertedWith("Invalid price");
    });

    it("Should clear prices", async function () {
      await market.setPrices([await paymentToken.getAddress()], [TOKEN_PRICE], [18]);
      await market.clearPrices();
      
      expect(await market.isTokenModed(await paymentToken.getAddress())).to.be.false;
    });
  });

  describe("Credit", function () {
    const stableAmount = 100000000n; // $1 with 8 decimals

    beforeEach(async function () {
      await market.setPrices(
        [await paymentToken.getAddress()],
        [TOKEN_PRICE],
        [18]
      );
    });

    it("Should credit stable tokens correctly", async function () {
      const paymentAmount = (stableAmount * ethers.parseEther("1")) / TOKEN_PRICE;
      
      await paymentToken.connect(user1).approve(await market.getAddress(), paymentAmount);
      
      await expect(market.connect(user1).credit(await paymentToken.getAddress(), stableAmount))
        .to.emit(market, "Credit");

      expect(await market.balanceOf(user1.address)).to.equal(stableAmount);
    });

    it("Should transfer payment to treasury", async function () {
      const paymentAmount = (stableAmount * ethers.parseEther("1")) / TOKEN_PRICE;
      
      await paymentToken.connect(user1).approve(await market.getAddress(), paymentAmount);
      
      const treasuryBalanceBefore = await paymentToken.balanceOf(treasury.address);
      await market.connect(user1).credit(await paymentToken.getAddress(), stableAmount);
      const treasuryBalanceAfter = await paymentToken.balanceOf(treasury.address);

      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(paymentAmount);
    });

    it("Should reject non-whitelisted token", async function () {
      const Token = await ethers.getContractFactory("Token");
      const badToken = await Token.deploy("Bad Token", "BAD", INITIAL_SUPPLY);
      
      await expect(
        market.connect(user1).credit(await badToken.getAddress(), stableAmount)
      ).to.be.revertedWith("Token not whitelisted");
    });
  });

  describe("Debit", function () {
    const stableAmount = 100000000n;

    beforeEach(async function () {
      await market.setPrices([await paymentToken.getAddress()], [TOKEN_PRICE], [18]);
      
      const paymentAmount = (stableAmount * ethers.parseEther("1")) / TOKEN_PRICE;
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

  describe("Balance Query", function () {
    it("Should return correct balance", async function () {
      expect(await market.getBalance(user1.address)).to.equal(0);
    });
  });
});
