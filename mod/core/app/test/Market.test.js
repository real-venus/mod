const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Market Integration", function () {
  let market, tokenGate, treasury, owner, user1;
  
  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();
    
    // Deploy TokenGate
    const TokenGate = await ethers.getContractFactory("TokenGate");
    tokenGate = await TokenGate.deploy();
    await tokenGate.waitForDeployment();
    
    // Deploy Market
    const Market = await ethers.getContractFactory("Market");
    market = await Market.deploy(
      "Market Token",
      "MKT",
      owner.address, // treasury
      await tokenGate.getAddress()
    );
    await market.waitForDeployment();
    
    treasury = owner.address;
  });

  describe("Debit Functionality", function () {
    it("Should debit stable tokens correctly", async function () {
      // First credit some tokens
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const usdc = await MockERC20.deploy("USDC", "USDC", 6);
      await usdc.waitForDeployment();
      
      // Mint and approve
      await usdc.mint(user1.address, ethers.parseUnits("100", 6));
      await usdc.connect(user1).approve(await market.getAddress(), ethers.parseUnits("100", 6));
      
      // Whitelist token
      await tokenGate.whitelistToken(await usdc.getAddress(), await usdc.getAddress());
      
      // Credit
      await market.connect(user1).credit(await usdc.getAddress(), ethers.parseUnits("100", 6));
      
      // Now debit - FIX: use BigInt directly
      const debitAmount = 100000000n; // 100 * 10^6 in BigInt
      await expect(market.connect(user1).debit(debitAmount))
        .to.emit(market, "Debit")
        .withArgs(1, user1.address, debitAmount);
    });

    it("Should reject debit with insufficient balance", async function () {
      // Try to debit without balance - FIX: use BigInt directly
      const debitAmount = 200000000n; // 200 * 10^6 in BigInt
      await expect(
        market.connect(user1).debit(debitAmount)
      ).to.be.revertedWith("Insufficient balance");
    });
  });
});
