const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Perms", function () {
  let perms, owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const Perms = await ethers.getContractFactory("Perms");
    perms = await Perms.deploy();
    await perms.waitForDeployment();
  });

  describe("Key Management", function () {
    const parentKey = ethers.toUtf8Bytes("parent");
    const childKey = ethers.toUtf8Bytes("child1");

    it("Should add a key and set owner", async function () {
      await expect(perms.connect(user1).addKey(parentKey, childKey))
        .to.emit(perms, "KeyAdded");

      expect(await perms.getKeyCount(parentKey)).to.equal(1);
      expect(await perms.keyOwners(parentKey)).to.equal(user1.address);
    });

    it("Should reject add from non-owner", async function () {
      await perms.connect(user1).addKey(parentKey, childKey);
      await expect(
        perms.connect(user2).addKey(parentKey, ethers.toUtf8Bytes("child2"))
      ).to.be.revertedWith("Only parent key owner can add");
    });

    it("Should enforce max child keys", async function () {
      await perms.setMaxChildKeys(1);
      await perms.connect(user1).addKey(parentKey, childKey);
      await expect(
        perms.connect(user1).addKey(parentKey, ethers.toUtf8Bytes("child2"))
      ).to.be.revertedWith("Max child keys reached");
    });

    it("Should enforce max key size", async function () {
      await perms.setMaxKeySize(2);
      await expect(
        perms.connect(user1).addKey(parentKey, ethers.toUtf8Bytes("toolong"))
      ).to.be.revertedWith("Key size exceeds limit");
    });
  });

  describe("Key Removal", function () {
    const parentKey = ethers.toUtf8Bytes("parent");
    const childKey = ethers.toUtf8Bytes("child1");

    beforeEach(async function () {
      await perms.connect(user1).addKey(parentKey, childKey);
    });

    it("Should remove key by value", async function () {
      await expect(perms.connect(user1).removeKey(parentKey, childKey))
        .to.emit(perms, "KeyRemoved");
      expect(await perms.getKeyCount(parentKey)).to.equal(0);
    });

    it("Should remove key by index", async function () {
      await perms.connect(user1).removeKeyAtIndex(parentKey, 0);
      expect(await perms.getKeyCount(parentKey)).to.equal(0);
    });

    it("Should reject removal from non-owner", async function () {
      await expect(
        perms.connect(user2).removeKey(parentKey, childKey)
      ).to.be.revertedWith("Only parent key owner");
    });
  });

  describe("Set Keys", function () {
    const parentKey = ethers.toUtf8Bytes("parent");

    it("Should replace all keys", async function () {
      const keys = [ethers.toUtf8Bytes("a"), ethers.toUtf8Bytes("b")];
      await perms.connect(user1).setKeys(parentKey, keys);
      expect(await perms.getKeyCount(parentKey)).to.equal(2);
    });
  });

  describe("Key Ownership Transfer", function () {
    const parentKey = ethers.toUtf8Bytes("parent");

    beforeEach(async function () {
      await perms.connect(user1).addKey(parentKey, ethers.toUtf8Bytes("child"));
    });

    it("Should transfer key ownership", async function () {
      await perms.connect(user1).transferKeyOwnership(parentKey, user2.address);
      expect(await perms.keyOwners(parentKey)).to.equal(user2.address);
    });

    it("Should reject transfer to zero address", async function () {
      await expect(
        perms.connect(user1).transferKeyOwnership(parentKey, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid new owner");
    });
  });

  describe("Contract Ownership", function () {
    it("Should set ownerless", async function () {
      await perms.setOwnerless();
      expect(await perms.owner()).to.equal(ethers.ZeroAddress);
    });

    it("Should lock admin functions after ownerless", async function () {
      await perms.setOwnerless();
      await expect(perms.setMaxChildKeys(50)).to.be.revertedWith("Only contract owner");
    });
  });
});
