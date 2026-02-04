const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Market Integration", function () {
  let market, tokenGate, oracle, paymentToken, treasury, owner, user1, provider;
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const TOKEN_PRICE = 100000000n; // $1.00 with 8 decimals

  beforeEach(async function () {
    [owner, treasury, user1, provider] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Token");
    paymentToken = await Token.deploy("Payment Token", "PAY", INITIAL_SUPPLY);
    await paymentToken.waitForDeployment();

    const ManualPriceOracle = await ethers.getContractFactory("ManualPriceOracle");
    oracle = await ManualPriceOracle.deploy();
    await oracle.waitForDeployment();

    await oracle.setPrice(await paymentToken.getAddress(), TOKEN_PRICE, 18);

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
    await paymentToken.transfer(treasury.address, ethers.parseEther("100000"));
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
    const stableAmount = 10000000000n;

    it("Should credit with TokenGate oracle-based pricing", async function () {
      const paymentAmount = (stableAmount * BigInt(10 ** 18)) / TOKEN_PRICE;

      await paymentToken.connect(user1).approve(await market.getAddress(), paymentAmount);

      await expect(market.connect(user1).credit(await paymentToken.getAddress(), stableAmount))
        .to.emit(market, "Credit");

      expect(await market.balanceOf(user1.address)).to.equal(stableAmount);
    });

    it("Should handle dynamic oracle price updates via TokenGate", async function () {
      const newPrice = 200000000n;
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

  describe("Debit Functionality with Treasury Fee (Owner Only)", function () {
    const stableAmount = 10000000000n;

    beforeEach(async function () {
      const paymentAmount = (stableAmount * BigInt(10 ** 18)) / TOKEN_PRICE;
      await paymentToken.connect(user1).approve(await market.getAddress(), paymentAmount);
      await market.connect(user1).credit(await paymentToken.getAddress(), stableAmount);
    });

    it("Should allow owner to debit from client and credit provider with 5% treasury fee", async function () {
      const treasuryFee = (stableAmount * 5n) / 100n;
      const providerAmount = stableAmount - treasuryFee;

      const tx = await market.connect(owner).debit(user1.address, provider.address, stableAmount);
      const receipt = await tx.wait();
      
      // Find the Debit event
      const debitEvent = receipt.logs.find(log => {
        try {
          const parsed = market.interface.parseLog(log);
          return parsed.name === "Debit";
        } catch {
          return false;
        }
      });
      
      const parsedEvent = market.interface.parseLog(debitEvent);
      
      expect(parsedEvent.args.txId).to.equal(2); // txId should be 2 (1 from credit, 2 from debit)
      expect(parsedEvent.args.client).to.equal(user1.address);
      expect(parsedEvent.args.provider).to.equal(provider.address);
      expect(parsedEvent.args.amount).to.equal(stableAmount);
      expect(parsedEvent.args.treasuryFee).to.equal(treasuryFee);
      expect(parsedEvent.args.providerAmount).to.equal(providerAmount);

      expect(await market.balanceOf(user1.address)).to.equal(0);
      expect(await market.balanceOf(provider.address)).to.equal(providerAmount);
      expect(await market.balanceOf(treasury.address)).to.equal(treasuryFee);
    });

    it("Should reject debit from non-owner", async function () {
      await expect(
        market.connect(user1).debit(user1.address, provider.address, stableAmount)
      ).to.be.reverted;
    });

    it("Should reject debit with insufficient balance", async function () {
      await expect(
        market.connect(owner).debit(user1.address, provider.address, stableAmount * 2n)
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should reject debit with invalid client", async function () {
      await expect(
        market.connect(owner).debit(ethers.ZeroAddress, provider.address, stableAmount)
      ).to.be.revertedWith("Invalid client");
    });

    it("Should reject debit with invalid provider", async function () {
      await expect(
        market.connect(owner).debit(user1.address, ethers.ZeroAddress, stableAmount)
      ).to.be.revertedWith("Invalid provider");
    });

    it("Should calculate correct treasury fee percentage", async function () {
      const testAmount = 1000000000n;
      const expectedFee = (testAmount * 5n) / 100n;
      const expectedProvider = testAmount - expectedFee;

      await market.connect(owner).debit(user1.address, provider.address, testAmount);

      expect(await market.balanceOf(treasury.address)).to.equal(expectedFee);
      expect(await market.balanceOf(provider.address)).to.equal(expectedProvider);
    });

    it("Should allow owner to debit from any address to any address", async function () {
      const [, , user2, provider2] = await ethers.getSigners();
      
      // Credit user2 first
      const initialUserBalance = await market.balanceOf(user2.address);
      const paymentAmount = (stableAmount * BigInt(10 ** 18)) / TOKEN_PRICE;
      await paymentToken.transfer(user2.address, paymentAmount);
      await paymentToken.connect(user2).approve(await market.getAddress(), paymentAmount);
      await market.connect(user2).credit(await paymentToken.getAddress(), stableAmount);

      const treasuryFeeBefore = await market.balanceOf(treasury.address);
      const treasuryFee = (stableAmount * 5n) / 100n;
      const providerAmount = stableAmount - treasuryFee;

      // Owner debits from user2 to provider2
      await expect(market.connect(owner).debit(user2.address, provider2.address, stableAmount))
        .to.emit(market, "Debit");

      expect(await market.balanceOf(user2.address)).to.equal(initialUserBalance);
      expect(await market.balanceOf(provider2.address)).to.equal(providerAmount);
      expect(await market.balanceOf(treasury.address)).to.equal(treasuryFeeBefore + treasuryFee);
    });
  });

  describe("Withdrawal Tests", function () {
    const stableAmount = 10000000000n;

    beforeEach(async function () {
      const paymentAmount = (stableAmount * BigInt(10 ** 18)) / TOKEN_PRICE;
      await paymentToken.connect(user1).approve(await market.getAddress(), paymentAmount);
      await market.connect(user1).credit(await paymentToken.getAddress(), stableAmount);
    });

    it("Should allow immediate withdrawal without lockup", async function () {
      const paymentAmount = (stableAmount * BigInt(10 ** 18)) / TOKEN_PRICE;

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
      const newPrice = 200000000n;
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
