const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Registry", function () {
  let registry, owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("Registry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();
  });

  describe("Mod Registration", function () {
    const modData = "ipfs://QmTest123";

    it("Should register mod correctly", async function () {
      await expect(registry.connect(user1).registerMod(modData))
        .to.emit(registry, "ModRegistered");

      const [modOwner, data] = await registry.getMod(1);
      expect(modOwner).to.equal(user1.address);
      expect(data).to.equal(modData);
    });

    it("Should increment mod ID", async function () {
      await registry.connect(user1).registerMod(modData);
      await registry.connect(user1).registerMod(modData);

      expect(await registry.nextModId()).to.equal(3);
    });

    it("Should track user mods", async function () {
      await registry.connect(user1).registerMod(modData);
      await registry.connect(user1).registerMod(modData);

      const userMods = await registry.getUserMods(user1.address);
      expect(userMods.length).to.equal(2);
    });
  });

  describe("Mod Update", function () {
    const modData = "ipfs://QmTest123";
    const newData = "ipfs://QmTest456";

    beforeEach(async function () {
      await registry.connect(user1).registerMod(modData);
    });

    it("Should update mod data", async function () {
      await expect(registry.connect(user1).updateMod(1, newData))
        .to.emit(registry, "ModUpdated");

      const [, data] = await registry.getMod(1);
      expect(data).to.equal(newData);
    });

    it("Should reject update from non-owner", async function () {
      await expect(
        registry.connect(user2).updateMod(1, newData)
      ).to.be.revertedWith("Not mod owner");
    });
  });

  describe("Mod Removal", function () {
    const modData = "ipfs://QmTest123";

    beforeEach(async function () {
      await registry.connect(user1).registerMod(modData);
    });

    it("Should remove mod correctly", async function () {
      await expect(registry.connect(user1).removeMod(1))
        .to.emit(registry, "ModRemoved");

      const [modOwner] = await registry.getMod(1);
      expect(modOwner).to.equal(ethers.ZeroAddress);
    });

    it("Should remove from user mods list", async function () {
      await registry.connect(user1).removeMod(1);
      
      const userMods = await registry.getUserMods(user1.address);
      expect(userMods.length).to.equal(0);
    });
  });

  describe("Ownership Transfer", function () {
    const modData = "ipfs://QmTest123";

    beforeEach(async function () {
      await registry.connect(user1).registerMod(modData);
    });

    it("Should transfer ownership correctly", async function () {
      await expect(registry.connect(user1).transferOwnership(1, user2.address))
        .to.emit(registry, "OwnershipTransferred");

      const [modOwner] = await registry.getMod(1);
      expect(modOwner).to.equal(user2.address);
    });

    it("Should update user mods lists", async function () {
      await registry.connect(user1).transferOwnership(1, user2.address);

      const user1Mods = await registry.getUserMods(user1.address);
      const user2Mods = await registry.getUserMods(user2.address);

      expect(user1Mods.length).to.equal(0);
      expect(user2Mods.length).to.equal(1);
    });
  });
});
