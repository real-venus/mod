const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenGate", function () {
  let tokenGate, oracle, token, owner, user1;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    // Deploy oracle
    const Oracle = await ethers.getContractFactory("ManualPriceOracle");
    oracle = await Oracle.deploy();
    await oracle.waitForDeployment();

    // Deploy test token
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("USDC", "USDC", ethers.parseEther("1000000"));
    await token.waitForDeployment();

    // Deploy TokenGate
    const TokenGate = await ethers.getContractFactory("TokenGate");
    tokenGate = await TokenGate.deploy(await oracle.getAddress());
    await tokenGate.waitForDeployment();

    // Set price for token in oracle
    await oracle.setPrice(await token.getAddress(), 100000000, 8); // $1.00
  });

  describe("Deployment", function () {
    it("Should set default oracle", async function () {
      expect(await tokenGate.defaultOracle()).to.equal(await oracle.getAddress());
    });

    it("Should reject zero address oracle", async function () {
      const TokenGate = await ethers.getContractFactory("TokenGate");
      await expect(
        TokenGate.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid oracle");
    });
  });

  describe("Whitelist", function () {
    it("Should whitelist a token", async function () {
      await expect(tokenGate.whitelistToken(await token.getAddress()))
        .to.emit(tokenGate, "TokenWhitelisted");
      expect(await tokenGate.isTokenWhitelisted(await token.getAddress())).to.be.true;
    });

    it("Should reject double whitelist", async function () {
      await tokenGate.whitelistToken(await token.getAddress());
      await expect(
        tokenGate.whitelistToken(await token.getAddress())
      ).to.be.revertedWith("Already whitelisted");
    });

    it("Should reject token without price feed", async function () {
      const Token2 = await ethers.getContractFactory("Token");
      const token2 = await Token2.deploy("NO", "NO", 1000);
      await token2.waitForDeployment();

      await expect(
        tokenGate.whitelistToken(await token2.getAddress())
      ).to.be.revertedWith("No oracle price feed");
    });

    it("Should reject non-owner", async function () {
      await expect(
        tokenGate.connect(user1).whitelistToken(await token.getAddress())
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Delist", function () {
    beforeEach(async function () {
      await tokenGate.whitelistToken(await token.getAddress());
    });

    it("Should delist a token", async function () {
      await expect(tokenGate.delistToken(await token.getAddress()))
        .to.emit(tokenGate, "TokenDelisted");
      expect(await tokenGate.isTokenWhitelisted(await token.getAddress())).to.be.false;
    });

    it("Should remove from token list", async function () {
      await tokenGate.delistToken(await token.getAddress());
      const list = await tokenGate.getTokenList();
      expect(list.length).to.equal(0);
    });
  });

  describe("Get Token Price", function () {
    beforeEach(async function () {
      await tokenGate.whitelistToken(await token.getAddress());
    });

    it("Should return price from oracle", async function () {
      const [price, decimals] = await tokenGate.getTokenPrice(await token.getAddress());
      expect(price).to.equal(100000000);
      expect(decimals).to.equal(8);
    });

    it("Should reject non-whitelisted token", async function () {
      await expect(
        tokenGate.getTokenPrice(ethers.ZeroAddress)
      ).to.be.revertedWith("Token not whitelisted");
    });
  });

  describe("Oracle Management", function () {
    it("Should update default oracle", async function () {
      const Oracle2 = await ethers.getContractFactory("ManualPriceOracle");
      const oracle2 = await Oracle2.deploy();
      await oracle2.waitForDeployment();

      await tokenGate.setDefaultOracle(await oracle2.getAddress());
      expect(await tokenGate.defaultOracle()).to.equal(await oracle2.getAddress());
    });

    it("Should register token-specific oracle", async function () {
      const Oracle2 = await ethers.getContractFactory("ManualPriceOracle");
      const oracle2 = await Oracle2.deploy();
      await oracle2.waitForDeployment();

      await expect(
        tokenGate.registerTokenOracle(await token.getAddress(), await oracle2.getAddress())
      ).to.emit(tokenGate, "TokenOracleRegistered");
    });
  });

  describe("Batch Whitelist", function () {
    it("Should batch whitelist tokens", async function () {
      const Token2 = await ethers.getContractFactory("Token");
      const token2 = await Token2.deploy("USDT", "USDT", ethers.parseEther("1000000"));
      await token2.waitForDeployment();
      await oracle.setPrice(await token2.getAddress(), 100000000, 8);

      await tokenGate.batchWhitelistTokens([
        await token.getAddress(),
        await token2.getAddress(),
      ]);

      const list = await tokenGate.getTokenList();
      expect(list.length).to.equal(2);
    });
  });
});
