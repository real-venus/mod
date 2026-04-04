const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BlocTime Protocol - Full Integration Tests", function () {
  let blocTime, market, registry, treasury, tokenGate, oracle;
  let nativeToken, paymentToken;
  let owner, user1, user2, moduleOwner;
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const TOKEN_PRICE = 100000000n; // $1 with 8 decimals

  beforeEach(async function () {
    [owner, user1, user2, moduleOwner] = await ethers.getSigners();

    // Deploy tokens
    const Token = await ethers.getContractFactory("Token");
    nativeToken = await Token.deploy("Native Token", "NAT", INITIAL_SUPPLY);
    await nativeToken.waitForDeployment();
    paymentToken = await Token.deploy("Payment Token", "PAY", INITIAL_SUPPLY);
    await paymentToken.waitForDeployment();

    // Deploy oracle
    const ManualPriceOracle = await ethers.getContractFactory("ManualPriceOracle");
    oracle = await ManualPriceOracle.deploy();
    await oracle.waitForDeployment();
    await oracle.setPrice(await paymentToken.getAddress(), TOKEN_PRICE, 8);

    // Deploy TokenGate
    const TokenGate = await ethers.getContractFactory("TokenGate");
    tokenGate = await TokenGate.deploy(await oracle.getAddress());
    await tokenGate.waitForDeployment();
    await tokenGate.whitelistToken(await paymentToken.getAddress());

    // Deploy BlocTime
    const BlocTime = await ethers.getContractFactory("BlocTime");
    blocTime = await BlocTime.deploy(
      await nativeToken.getAddress(),
      "BlocTime Token",
      "BLOC",
      100000,
      5000
    );
    await blocTime.waitForDeployment();

    const points = [
      { blocks: 0, multiplier: 10000 },
      { blocks: 10000, multiplier: 15000 },
      { blocks: 50000, multiplier: 20000 },
      { blocks: 100000, multiplier: 30000 }
    ];
    await blocTime.setPoints(points);

    // Deploy Registry
    const Registry = await ethers.getContractFactory("Registry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();

    // Deploy Treasury with TokenGate
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(2000, await tokenGate.getAddress());
    await treasury.waitForDeployment();
    await treasury.setGovernanceToken(await blocTime.getAddress());

    // Deploy Market
    const Market = await ethers.getContractFactory("Market");
    market = await Market.deploy(
      "Market Token",
      "MKT",
      await treasury.getAddress(),
      await tokenGate.getAddress()
    );
    await market.waitForDeployment();

    // Distribute tokens
    await nativeToken.transfer(user1.address, ethers.parseEther("10000"));
    await nativeToken.transfer(user2.address, ethers.parseEther("10000"));
    await paymentToken.transfer(user1.address, ethers.parseEther("10000"));
    await paymentToken.transfer(user2.address, ethers.parseEther("10000"));
  });

  describe("End-to-End Workflow", function () {
    it("Should complete full staking and marketplace flow", async function () {
      // 1. Users stake tokens
      const stakeAmount = ethers.parseEther("100");
      await nativeToken.connect(user1).approve(await blocTime.getAddress(), stakeAmount);
      await blocTime.connect(user1).stake(stakeAmount, 50000);

      await nativeToken.connect(user2).approve(await blocTime.getAddress(), stakeAmount);
      await blocTime.connect(user2).stake(stakeAmount, 10000);

      // Verify BlocTime balances
      const user1BlocTime = await blocTime.balanceOf(user1.address);
      const user2BlocTime = await blocTime.balanceOf(user2.address);
      expect(user1BlocTime).to.be.gt(user2BlocTime); // user1 locked longer

      // 2. Register module in Registry with name and data
      await registry.connect(moduleOwner).registerMod(
        "TestModule",
        "ipfs://test-metadata"
      );

      // 3. User credits market with payment tokens
      const creditAmount = 100000000n; // $1
      const paymentAmount = (creditAmount * ethers.parseEther("1")) / TOKEN_PRICE;
      await paymentToken.connect(user1).approve(await market.getAddress(), paymentAmount);
      await market.connect(user1).credit(await paymentToken.getAddress(), creditAmount, paymentAmount);

      // 4. Fund treasury from market fees
      const treasuryFee = ethers.parseEther("10");
      await paymentToken.approve(await treasury.getAddress(), treasuryFee);
      await treasury.fundTreasury(await paymentToken.getAddress(), treasuryFee);

      // 5. Users claim rewards proportional to BlocTime holdings
      const user1Claimable = await treasury.getClaimableAmount(
        user1.address,
        await paymentToken.getAddress()
      );
      const user2Claimable = await treasury.getClaimableAmount(
        user2.address,
        await paymentToken.getAddress()
      );

      expect(user1Claimable).to.be.gt(user2Claimable); // user1 has more BlocTime

      await treasury.connect(user1).withdrawToken(await paymentToken.getAddress());
      expect(await paymentToken.balanceOf(user1.address)).to.be.gt(0);
    });

    it("Should handle multiple stakers and fair distribution", async function () {
      // Multiple users stake different amounts
      await nativeToken.connect(user1).approve(await blocTime.getAddress(), ethers.parseEther("200"));
      await blocTime.connect(user1).stake(ethers.parseEther("200"), 100000);

      await nativeToken.connect(user2).approve(await blocTime.getAddress(), ethers.parseEther("100"));
      await blocTime.connect(user2).stake(ethers.parseEther("100"), 50000);

      const totalBlocTime = await blocTime.totalSupply();
      const user1Share = await blocTime.balanceOf(user1.address);
      const user2Share = await blocTime.balanceOf(user2.address);

      // Fund treasury
      const fundAmount = ethers.parseEther("100");
      await paymentToken.approve(await treasury.getAddress(), fundAmount);
      await treasury.fundTreasury(await paymentToken.getAddress(), fundAmount);

      // Check proportional distribution
      const user1Claimable = await treasury.getClaimableAmount(user1.address, await paymentToken.getAddress());
      const user2Claimable = await treasury.getClaimableAmount(user2.address, await paymentToken.getAddress());

      const expectedRatio = user1Share * 10000n / user2Share;
      const actualRatio = user1Claimable * 10000n / user2Claimable;
      
      expect(actualRatio).to.be.closeTo(expectedRatio, 100n); // Allow 1% variance
    });
  });

  describe("Security and Edge Cases", function () {
    it("Should prevent reentrancy attacks", async function () {
      const stakeAmount = ethers.parseEther("100");
      await nativeToken.connect(user1).approve(await blocTime.getAddress(), stakeAmount);
      await blocTime.connect(user1).stake(stakeAmount, 10);

      const stakeIds = await blocTime.getUserStakeIds(user1.address);
      await ethers.provider.send("hardhat_mine", ["0xa"]);

      // Should not allow double unstaking
      await blocTime.connect(user1).unstake(stakeIds[0]);
      await expect(blocTime.connect(user1).unstake(stakeIds[0])).to.be.reverted;
    });

    it("Should handle zero balances gracefully", async function () {
      // User has no governance tokens, should return 0 claimable
      const claimable = await treasury.getClaimableAmount(user1.address, await paymentToken.getAddress());
      expect(claimable).to.equal(0);

      await expect(treasury.connect(user1).withdrawToken(await paymentToken.getAddress()))
        .to.be.revertedWith("Nothing to claim");
    });

    it("Should enforce access control", async function () {
      await expect(oracle.connect(user1).setPrice(await paymentToken.getAddress(), TOKEN_PRICE, 8))
        .to.be.reverted;
    });
  });

  describe("TokenGate Whitelist Integration", function () {
    it("Should use TokenGate whitelist for treasury tokens", async function () {
      // Treasury should use TokenGate's whitelist
      const treasuryTokens = await treasury.getTreasuryTokens();
      const tokenGateTokens = await tokenGate.getTokenList();
      
      expect(treasuryTokens.length).to.equal(tokenGateTokens.length);
      expect(treasuryTokens[0]).to.equal(tokenGateTokens[0]);
    });

    it("Should sync when TokenGate whitelist changes", async function () {
      // Add new token to TokenGate
      const Token = await ethers.getContractFactory("Token");
      const newToken = await Token.deploy("New Token", "NEW", INITIAL_SUPPLY);
      await newToken.waitForDeployment();
      await oracle.setPrice(await newToken.getAddress(), TOKEN_PRICE, 8);
      await tokenGate.whitelistToken(await newToken.getAddress());

      // Treasury should automatically see it
      const treasuryTokens = await treasury.getTreasuryTokens();
      expect(treasuryTokens.length).to.equal(2);
      expect(treasuryTokens[1]).to.equal(await newToken.getAddress());

      // Should be able to fund with new token
      await newToken.approve(await treasury.getAddress(), ethers.parseEther("100"));
      await expect(treasury.fundTreasury(await newToken.getAddress(), ethers.parseEther("100")))
        .to.emit(treasury, "TreasuryFunded");
    });
  });
});
