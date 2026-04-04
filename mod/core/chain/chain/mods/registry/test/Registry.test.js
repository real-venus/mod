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

  describe("Registration", function () {
    it("Should register a mod", async function () {
      await expect(registry.connect(user1).registerMod("mymod", "ipfs://abc"))
        .to.emit(registry, "ModRegistered");

      const [modOwner, name, data] = await registry.getMod(1);
      expect(modOwner).to.equal(user1.address);
      expect(name).to.equal("mymod");
      expect(data).to.equal("ipfs://abc");
    });

    it("Should enforce unique names per creator", async function () {
      await registry.connect(user1).registerMod("mymod", "ipfs://abc");
      await expect(
        registry.connect(user1).registerMod("mymod", "ipfs://def")
      ).to.be.revertedWith("Name already exists for this creator");
    });

    it("Should allow same name for different creators", async function () {
      await registry.connect(user1).registerMod("mymod", "ipfs://abc");
      await expect(
        registry.connect(user2).registerMod("mymod", "ipfs://def")
      ).to.emit(registry, "ModRegistered");
    });

    it("Should reject empty name", async function () {
      await expect(
        registry.connect(user1).registerMod("", "ipfs://abc")
      ).to.be.revertedWith("Invalid name");
    });

    it("Should reject empty data", async function () {
      await expect(
        registry.connect(user1).registerMod("mymod", "")
      ).to.be.revertedWith("Invalid data");
    });

    it("Should increment mod IDs", async function () {
      await registry.connect(user1).registerMod("mod1", "data1");
      await registry.connect(user1).registerMod("mod2", "data2");
      expect(await registry.nextModId()).to.equal(3);
    });

    it("Should track user mods", async function () {
      await registry.connect(user1).registerMod("mod1", "data1");
      await registry.connect(user1).registerMod("mod2", "data2");
      const mods = await registry.getUserMods(user1.address);
      expect(mods.length).to.equal(2);
    });
  });

  describe("Update", function () {
    beforeEach(async function () {
      await registry.connect(user1).registerMod("mymod", "ipfs://old");
    });

    it("Should update mod data", async function () {
      await expect(registry.connect(user1).updateMod(1, "ipfs://new"))
        .to.emit(registry, "ModUpdated");
      const [, , data] = await registry.getMod(1);
      expect(data).to.equal("ipfs://new");
    });

    it("Should reject update from non-owner", async function () {
      await expect(
        registry.connect(user2).updateMod(1, "ipfs://new")
      ).to.be.revertedWith("Not mod owner");
    });
  });

  describe("Removal", function () {
    beforeEach(async function () {
      await registry.connect(user1).registerMod("mymod", "ipfs://abc");
    });

    it("Should remove mod", async function () {
      await expect(registry.connect(user1).removeMod(1))
        .to.emit(registry, "ModRemoved");
      const [modOwner] = await registry.getMod(1);
      expect(modOwner).to.equal(ethers.ZeroAddress);
    });

    it("Should free name for reuse", async function () {
      await registry.connect(user1).removeMod(1);
      expect(await registry.isNameTaken(user1.address, "mymod")).to.be.false;
      await expect(
        registry.connect(user1).registerMod("mymod", "ipfs://new")
      ).to.emit(registry, "ModRegistered");
    });
  });

  describe("Ownership Transfer", function () {
    beforeEach(async function () {
      await registry.connect(user1).registerMod("mymod", "ipfs://abc");
    });

    it("Should transfer mod ownership", async function () {
      await expect(registry.connect(user1).transferOwnership(1, user2.address))
        .to.emit(registry, "OwnershipTransferred");
      const [modOwner] = await registry.getMod(1);
      expect(modOwner).to.equal(user2.address);
    });

    it("Should update user mod lists", async function () {
      await registry.connect(user1).transferOwnership(1, user2.address);
      expect((await registry.getUserMods(user1.address)).length).to.equal(0);
      expect((await registry.getUserMods(user2.address)).length).to.equal(1);
    });

    it("Should reject transfer if name taken for new owner", async function () {
      await registry.connect(user2).registerMod("mymod", "ipfs://def");
      await expect(
        registry.connect(user1).transferOwnership(1, user2.address)
      ).to.be.revertedWith("Name already exists for new owner");
    });
  });
});
