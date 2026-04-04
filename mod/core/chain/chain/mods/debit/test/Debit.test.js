const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Debit", function () {
  let debit, market, tokenGate, oracle, usdc, owner, client, provider, treasury;

  beforeEach(async function () {
    [owner, client, provider, treasury] = await ethers.getSigners();

    // Deploy oracle
    const Oracle = await ethers.getContractFactory("ManualPriceOracle");
    oracle = await Oracle.deploy();
    await oracle.waitForDeployment();

    // Deploy USDC
    const Token = await ethers.getContractFactory("Token");
    usdc = await Token.deploy("USDC", "USDC", ethers.parseEther("1000000"));
    await usdc.waitForDeployment();

    await oracle.setPrice(await usdc.getAddress(), 100000000, 8);

    // Deploy TokenGate
    const TokenGate = await ethers.getContractFactory("TokenGate");
    tokenGate = await TokenGate.deploy(await oracle.getAddress());
    await tokenGate.waitForDeployment();
    await tokenGate.whitelistToken(await usdc.getAddress());

    // Deploy Market
    const Market = await ethers.getContractFactory("Market");
    market = await Market.deploy(
      "Market", "MKT",
      treasury.address,
      await tokenGate.getAddress()
    );
    await market.waitForDeployment();

    // Deploy Debit
    const Debit = await ethers.getContractFactory("Debit");
    debit = await Debit.deploy(await market.getAddress());
    await debit.waitForDeployment();

    // Authorize debit contract in market
    await market.setDebitContract(await debit.getAddress());

    // Give client some market tokens via credit
    const creditAmount = 100_00000000n; // 100 tokens (8 dec)
    const maxPayment = ethers.parseEther("200");
    await usdc.transfer(client.address, ethers.parseEther("1000"));
    await usdc.connect(client).approve(await market.getAddress(), maxPayment);
    await market.connect(client).credit(await usdc.getAddress(), creditAmount, maxPayment);
  });

  describe("Deployment", function () {
    it("Should set market", async function () {
      expect(await debit.market()).to.equal(await market.getAddress());
    });

    it("Should start with signature not required", async function () {
      expect(await debit.signatureRequired()).to.be.false;
    });
  });

  describe("Unsigned Debit", function () {
    it("Should execute unsigned debit as owner", async function () {
      const amount = 10_00000000n; // 10 tokens
      await expect(
        debit.executeDebitUnsigned(client.address, provider.address, amount)
      ).to.emit(debit, "DebitExecuted");

      // Provider should have received 95% (5% treasury fee)
      const providerBal = await market.balanceOf(provider.address);
      expect(providerBal).to.equal(9_50000000n);
    });

    it("Should reject non-owner unsigned debit", async function () {
      await expect(
        debit.connect(client).executeDebitUnsigned(client.address, provider.address, 100)
      ).to.be.revertedWith("Unauthorized");
    });

    it("Should enforce daily spending limit", async function () {
      await debit.connect(client).setDailyLimit(5_00000000n); // 5 token limit

      await expect(
        debit.executeDebitUnsigned(client.address, provider.address, 10_00000000n)
      ).to.be.revertedWith("Daily spending limit exceeded");
    });
  });

  describe("Authority Management", function () {
    it("Should add authority", async function () {
      await expect(debit.connect(client).addAuthority(provider.address))
        .to.emit(debit, "AuthorityAdded");
      expect(await debit.isAuthority(client.address, provider.address)).to.be.true;
    });

    it("Should remove authority", async function () {
      await debit.connect(client).addAuthority(provider.address);
      await debit.connect(client).removeAuthority(provider.address);
      expect(await debit.isAuthority(client.address, provider.address)).to.be.false;
    });

    it("Should set approval threshold", async function () {
      await debit.connect(client).addAuthority(provider.address);
      await debit.connect(client).setApprovalThreshold(1);
      expect(await debit.getEffectiveThreshold(client.address)).to.equal(1);
    });
  });

  describe("Admin", function () {
    it("Should update market address", async function () {
      await debit.setMarket(provider.address);
      expect(await debit.market()).to.equal(provider.address);
    });

    it("Should toggle signature requirement", async function () {
      await debit.setSignatureRequired(true);
      expect(await debit.signatureRequired()).to.be.true;

      await expect(
        debit.executeDebitUnsigned(client.address, provider.address, 100)
      ).to.be.revertedWith("Signatures required");
    });
  });
});
