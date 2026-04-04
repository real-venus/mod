const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ManualPriceOracle", function () {
  let oracle, owner, user1, tokenAddr;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();
    tokenAddr = "0x0000000000000000000000000000000000000001";

    const Oracle = await ethers.getContractFactory("ManualPriceOracle");
    oracle = await Oracle.deploy();
    await oracle.waitForDeployment();
  });

  describe("Set Price", function () {
    it("Should set price for a token", async function () {
      await expect(oracle.setPrice(tokenAddr, 100000000, 8))
        .to.emit(oracle, "PriceUpdated");

      const [price, decimals] = await oracle.getPrice(tokenAddr);
      expect(price).to.equal(100000000);
      expect(decimals).to.equal(8);
    });

    it("Should reject zero price", async function () {
      await expect(
        oracle.setPrice(tokenAddr, 0, 8)
      ).to.be.revertedWith("Invalid price");
    });

    it("Should reject zero address", async function () {
      await expect(
        oracle.setPrice(ethers.ZeroAddress, 100, 8)
      ).to.be.revertedWith("Invalid token");
    });

    it("Should reject non-owner", async function () {
      await expect(
        oracle.connect(user1).setPrice(tokenAddr, 100, 8)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Batch Set Prices", function () {
    it("Should set multiple prices", async function () {
      const addr2 = "0x0000000000000000000000000000000000000002";
      await oracle.batchSetPrices(
        [tokenAddr, addr2],
        [100000000, 200000000],
        [8, 8]
      );

      const [p1] = await oracle.getPrice(tokenAddr);
      const [p2] = await oracle.getPrice(addr2);
      expect(p1).to.equal(100000000);
      expect(p2).to.equal(200000000);
    });

    it("Should reject mismatched arrays", async function () {
      await expect(
        oracle.batchSetPrices([tokenAddr], [100, 200], [8])
      ).to.be.revertedWith("Array length mismatch");
    });
  });

  describe("Remove Price", function () {
    it("Should remove a price", async function () {
      await oracle.setPrice(tokenAddr, 100, 8);
      await expect(oracle.removePrice(tokenAddr))
        .to.emit(oracle, "PriceRemoved");

      expect(await oracle.hasPriceFeed(tokenAddr)).to.be.false;
    });

    it("Should revert if price not set", async function () {
      await expect(
        oracle.removePrice(tokenAddr)
      ).to.be.revertedWith("Price not set");
    });
  });

  describe("Has Price Feed", function () {
    it("Should return false for unset token", async function () {
      expect(await oracle.hasPriceFeed(tokenAddr)).to.be.false;
    });

    it("Should return true after setting price", async function () {
      await oracle.setPrice(tokenAddr, 100, 8);
      expect(await oracle.hasPriceFeed(tokenAddr)).to.be.true;
    });
  });

  describe("Set Ownerless", function () {
    it("Should renounce ownership", async function () {
      await oracle.setOwnerless();
      expect(await oracle.owner()).to.equal(ethers.ZeroAddress);
    });

    it("Should lock setPrice after ownerless", async function () {
      await oracle.setOwnerless();
      await expect(
        oracle.setPrice(tokenAddr, 100, 8)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
